import type { JobWithMetadata } from "pg-boss";
import { boss, SEND_EMAIL_QUEUE } from "../../common/queue/boss";
import { sendMail } from "../../common/mail/mailer";
import { renderTemplate } from "../../common/utils/renderTemplate";
import { makeUnsubscribeToken } from "../../common/utils/unsubscribeToken";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { domainsService } from "../domains/domains.service";
import { mailboxesService } from "../mailboxes/mailboxes.service";
import { campaignsRepository } from "./campaigns.repository";

export interface SendEmailJobData {
  tenantId: number;
  campaignId: number;
  email: string;
  subscriberId: number | null;
}

const SEND_RATE_SETTING_KEY = "send_rate_per_minute";

// Per-tenant, editable live from Settings — not a static env var, so an org
// can tune their own throttle without a restart.
async function minMsBetweenSends(tenantId: number): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { tenantId_key: { tenantId, key: SEND_RATE_SETTING_KEY } } });
  const ratePerMinute = typeof row?.value === "number" && row.value > 0 ? row.value : env.sendRatePerMinute;
  return 60_000 / Math.max(1, ratePerMinute);
}

// Sends for the same tenant are already serialized by pg-boss itself —
// every job is enqueued with `group: { id: "tenant:{id}" }` (see
// campaigns.service.enqueueEligible) and the worker below sets
// localGroupConcurrency: 1, so at most one job per tenant ever runs at a
// time. That means a plain "read last timestamp, sleep the remainder" is
// safe here with no race — two jobs for the same tenant literally cannot
// be mid-pacing-check simultaneously.
// ponytail: in-process Map, so this (and the group-concurrency guarantee
// above) only holds within a single backend replica — matches this
// project's existing single-instance assumption (see config/prisma.ts).
const lastSendAt = new Map<number, number>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pace(tenantId: number) {
  const minGapMs = await minMsBetweenSends(tenantId);
  const elapsed = Date.now() - (lastSendAt.get(tenantId) ?? 0);
  if (elapsed < minGapMs) await sleep(minGapMs - elapsed);
  lastSendAt.set(tenantId, Date.now());
}

// A capacity limit (domain warmup / mailbox daily cap) isn't a failure — the
// job completes as a no-op (no CampaignSend row written) so the recipient
// stays "eligible" and the next scheduler tick naturally re-enqueues them
// once quota is available, without burning into the real retry budget that
// transient SMTP failures use.
class CapReachedError extends Error {}

async function handleSendEmail(job: SendEmailJobData, retryCount: number, retryLimit: number) {
  const { tenantId, campaignId, email, subscriberId } = job;

  const campaign = await campaignsRepository.findById(tenantId, campaignId);
  if (!campaign || campaign.status !== "running") return; // paused/cancelled/deleted since enqueue — drop silently.

  const suppressed = await prisma.suppression.findUnique({ where: { tenantId_email: { tenantId, email } } });
  if (suppressed) return; // suppressed after this job was enqueued — drop silently, no CampaignSend row needed.

  const fromDomain = campaign.fromEmail.match(/@([^\s>]+)/)?.[1]?.toLowerCase();

  try {
    if (fromDomain && !(await domainsService.canSendOne(fromDomain))) throw new CapReachedError("domain daily cap reached");
    if (!(await mailboxesService.canSendOne(campaign.fromEmail))) throw new CapReachedError("mailbox daily cap reached");

    await pace(tenantId);

    const subscriber = subscriberId
      ? await prisma.subscriber.findUnique({ where: { id: subscriberId } })
      : { id: null, uuid: "", email, name: email.split("@")[0], attribs: {}, status: "enabled" as const };

    const unsubToken = makeUnsubscribeToken(tenantId, email);
    const unsubscribeUrl = `${env.publicUrl}/api/public/unsubscribe-link?email=${encodeURIComponent(email)}&token=${unsubToken}&campaign=${campaign.uuid}`;
    const data = { Subscriber: subscriber, Campaign: campaign, UnsubscribeUrl: unsubscribeUrl };

    await sendMail({
      to: email,
      from: campaign.fromEmail,
      cc: campaign.cc,
      bcc: campaign.bcc,
      subject: renderTemplate(campaign.subject, data),
      html: campaign.contentType === "plain" ? undefined : renderTemplate(campaign.body, data),
      text: campaign.contentType === "plain" ? renderTemplate(campaign.body, data) : campaign.altbody ?? undefined,
      headers: {
        "X-Campaign-UUID": campaign.uuid,
        "X-Subscriber-UUID": subscriber?.uuid ?? "",
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    await campaignsRepository.recordSend(campaignId, email, "sent", { subscriberId: subscriberId ?? undefined });
    if (fromDomain) await domainsService.recordSend(fromDomain);
    await mailboxesService.recordSend(campaign.fromEmail);
    await campaignsRepository.incrementSent(tenantId, campaignId, 1);
    await checkFinished(tenantId, campaign.id, campaign.toEmails ?? []);
  } catch (err) {
    if (err instanceof CapReachedError) return; // no-op — resumes next tick once quota frees up.

    const message = err instanceof Error ? err.message : String(err);
    const exhausted = retryCount >= retryLimit;
    // `failed` mid-retry is NOT terminal (still "eligible" — see
    // campaigns.repository.ts); `undeliverable` on the final attempt is.
    await campaignsRepository.recordSend(campaignId, email, exhausted ? "undeliverable" : "failed", {
      subscriberId: subscriberId ?? undefined,
      error: message,
    });
    if (exhausted) await checkFinished(tenantId, campaign.id, campaign.toEmails ?? []);
    console.error(`campaign ${campaignId} send failed for ${email} (attempt ${retryCount + 1}/${retryLimit + 1}):`, err);
    throw err; // let pg-boss's retryLimit/retryBackoff handle re-scheduling.
  }
}

async function checkFinished(tenantId: number, campaignId: number, toEmails: string[]) {
  const pending = await campaignsRepository.hasPendingRecipients(tenantId, campaignId, toEmails);
  if (!pending) await campaignsRepository.updateStatus(tenantId, campaignId, "finished").catch(() => undefined);
}

export async function startCampaignWorker() {
  await boss.work<SendEmailJobData>(
    SEND_EMAIL_QUEUE,
    // localConcurrency: up to 5 jobs in flight at once, but
    // localGroupConcurrency: 1 caps it at one per tenant `group` (see
    // enqueueEligible) — different tenants send in parallel, one tenant's
    // own sends stay serialized so `pace()` above can safely assume no
    // concurrent access for the same tenant.
    { includeMetadata: true, localConcurrency: 5, localGroupConcurrency: 1 },
    async (jobs) => {
      // `includeMetadata: true` above does populate retryCount/retryLimit at
      // runtime; pg-boss's overload typing just doesn't narrow to
      // JobWithMetadata from an inline options literal, hence the cast.
      const job = jobs[0] as unknown as JobWithMetadata<SendEmailJobData>;
      await handleSendEmail(job.data, job.retryCount, job.retryLimit);
    }
  );
}
