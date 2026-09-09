import { CampaignStatus } from "@prisma/client";
import { ApiError } from "../../common/utils/ApiError";
import { sendMail } from "../../common/mail/mailer";
import { renderTemplate } from "../../common/utils/renderTemplate";
import { makeUnsubscribeToken } from "../../common/utils/unsubscribeToken";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { domainsService } from "../domains/domains.service";
import { mailboxesService } from "../mailboxes/mailboxes.service";
import { campaignsRepository } from "./campaigns.repository";

export interface CampaignInput {
  name: string;
  subject: string;
  fromEmail: string;
  body: string;
  altbody?: string;
  contentType?: "richtext" | "html" | "markdown" | "plain" | "visual";
  templateId?: number;
  tags?: string[];
  sendAt?: string;
  listIds: number[];
  // Ad-hoc recipients (a single address, or a handful) as an alternative or
  // addition to `listIds`. cc/bcc apply to every message the campaign sends.
  toEmails?: string[];
  cc?: string[];
  bcc?: string[];
}

// Mirrors the source app's campaign state machine (see FEATURES.md §5).
const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["scheduled", "running"],
  scheduled: ["draft", "running", "cancelled"],
  running: ["paused", "cancelled"],
  paused: ["running", "cancelled"],
  finished: [],
  cancelled: [],
};

// Guards against the scheduler re-invoking dispatch() on a campaign that's
// already mid-send (it re-checks every "running" campaign every tick so that
// a warmup-capped or interrupted send resumes on its own).
const activeDispatches = new Set<number>();

const SEND_RATE_SETTING_KEY = "send_rate_per_minute";

// Per-tenant, editable live from Settings — not a static env var, so an org
// can tune their own throttle without a restart. Falls back to the env
// default (see SEND_RATE_PER_MINUTE in .env) if never set.
async function minMsBetweenSends(tenantId: number): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { tenantId_key: { tenantId, key: SEND_RATE_SETTING_KEY } } });
  const ratePerMinute = typeof row?.value === "number" && row.value > 0 ? row.value : env.sendRatePerMinute;
  return 60_000 / Math.max(1, ratePerMinute);
}

export const campaignsService = {
  list(tenantId: number) {
    return campaignsRepository.findAll(tenantId);
  },

  async get(tenantId: number, id: number) {
    const campaign = await campaignsRepository.findById(tenantId, id);
    if (!campaign) throw ApiError.notFound("Campaign not found");
    return campaign;
  },

  deliveryLog(tenantId: number, id: number) {
    return campaignsRepository.deliveryLog(tenantId, id);
  },

  create(tenantId: number, input: CampaignInput) {
    if (!input.listIds.length && !input.toEmails?.length) {
      throw ApiError.badRequest("Provide at least one list or recipient e-mail");
    }
    return campaignsRepository.create(
      tenantId,
      {
        tenant: { connect: { id: tenantId } },
        name: input.name,
        subject: input.subject,
        fromEmail: input.fromEmail,
        body: input.body,
        altbody: input.altbody,
        contentType: input.contentType ?? "richtext",
        template: input.templateId ? { connect: { id: input.templateId } } : undefined,
        tags: input.tags ?? [],
        toEmails: input.toEmails ?? [],
        cc: input.cc ?? [],
        bcc: input.bcc ?? [],
        sendAt: input.sendAt ? new Date(input.sendAt) : undefined,
        status: input.sendAt ? "scheduled" : "draft",
      },
      input.listIds
    );
  },

  async update(tenantId: number, id: number, input: Partial<CampaignInput>) {
    const campaign = await campaignsService.get(tenantId, id);
    if (!["draft", "paused", "scheduled"].includes(campaign.status)) {
      throw ApiError.forbidden("Only draft, paused or scheduled campaigns can be edited");
    }
    return campaignsRepository.update(
      tenantId,
      id,
      {
        name: input.name,
        subject: input.subject,
        fromEmail: input.fromEmail,
        body: input.body,
        altbody: input.altbody,
        contentType: input.contentType,
        template: input.templateId ? { connect: { id: input.templateId } } : undefined,
        tags: input.tags,
        toEmails: input.toEmails,
        cc: input.cc,
        bcc: input.bcc,
        sendAt: input.sendAt ? new Date(input.sendAt) : undefined,
      },
      input.listIds
    );
  },

  async remove(tenantId: number, id: number) {
    const campaign = await campaignsService.get(tenantId, id);
    if (campaign.status === "running") throw ApiError.forbidden("Cannot delete a running campaign");
    await campaignsRepository.remove(tenantId, id);
  },

  async setStatus(tenantId: number, id: number, status: CampaignStatus) {
    const campaign = await campaignsService.get(tenantId, id);
    if (!ALLOWED_TRANSITIONS[campaign.status].includes(status)) {
      throw ApiError.badRequest(`Cannot move campaign from ${campaign.status} to ${status}`);
    }
    const updated = await campaignsRepository.updateStatus(tenantId, id, status);

    if (status === "running") {
      campaignsService.dispatch(tenantId, id).catch((err) => console.error(`campaign ${id} dispatch failed:`, err));
    }

    return updated;
  },

  // Re-invoked by the scheduler for every "running" campaign each tick, so a
  // send that stalled on a warmup/mailbox cap (or was interrupted by a
  // restart) continues on its own once quota is available again.
  async resumeRunning() {
    const running = await prisma.campaign.findMany({ where: { status: "running" }, select: { id: true, tenantId: true } });
    for (const c of running) {
      campaignsService.dispatch(c.tenantId, c.id).catch((err) => console.error(`campaign ${c.id} resume failed:`, err));
    }
  },

  // ponytail: in-process async loop, no background queue/worker (see
  // FEATURES.md §9 for what the source app does here). Fire-and-forget so
  // API calls / scheduler ticks return immediately. Safe to call repeatedly
  // on the same campaign — `activeDispatches` prevents overlap, and already
  // -sent recipients (CampaignSend, keyed by e-mail) are always skipped.
  async dispatch(tenantId: number, id: number) {
    if (activeDispatches.has(id)) return;
    activeDispatches.add(id);

    try {
      const campaign = await campaignsService.get(tenantId, id);
      const listSubscribers = await campaignsRepository.findEligibleSubscribers(tenantId, id);
      const sentEmails = await campaignsRepository.alreadySentEmails(id);

      const suppressed = new Set(
        (await prisma.suppression.findMany({ where: { tenantId }, select: { email: true } })).map((s) => s.email)
      );

      const adhoc = (campaign.toEmails ?? [])
        .filter(
          (email) => !listSubscribers.some((s) => s.email === email) && !sentEmails.has(email) && !suppressed.has(email)
        )
        .map((email) => ({
          id: null as number | null,
          uuid: "",
          email,
          name: email.split("@")[0],
          attribs: {},
          status: "enabled" as const,
        }));

      const recipients = [...listSubscribers, ...adhoc];
      const fromDomain = campaign.fromEmail.match(/@([^\s>]+)/)?.[1]?.toLowerCase();
      let lastSendAt = 0;

      let sent = 0;
      let cappedForToday = false;

      for (const recipient of recipients) {
        const current = await prisma.campaign.findUnique({ where: { id }, select: { status: true } });
        if (current?.status !== "running") return; // paused/cancelled mid-send — stop, leave status as-is.

        if (fromDomain && !(await domainsService.canSendOne(fromDomain))) {
          cappedForToday = true;
          break; // warmup daily cap reached — resume tomorrow via resumeRunning()
        }
        if (!(await mailboxesService.canSendOne(campaign.fromEmail))) {
          cappedForToday = true;
          break; // this mailbox's own daily cap reached
        }

        // Simple send-rate throttle — spread messages out rather than
        // bursting the whole batch at once. Re-read each time so a mid-send
        // change to the tenant's rate setting takes effect immediately.
        const wait = (await minMsBetweenSends(tenantId)) - (Date.now() - lastSendAt);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));

        const unsubToken = makeUnsubscribeToken(tenantId, recipient.email);
        const unsubscribeUrl = `${env.publicUrl}/api/public/unsubscribe-link?email=${encodeURIComponent(recipient.email)}&token=${unsubToken}`;

        const data = { Subscriber: recipient, Campaign: campaign, UnsubscribeUrl: unsubscribeUrl };
        lastSendAt = Date.now();
        try {
          await sendMail({
            to: recipient.email,
            from: campaign.fromEmail,
            cc: campaign.cc,
            bcc: campaign.bcc,
            subject: renderTemplate(campaign.subject, data),
            html: campaign.contentType === "plain" ? undefined : renderTemplate(campaign.body, data),
            text: campaign.contentType === "plain" ? renderTemplate(campaign.body, data) : campaign.altbody ?? undefined,
            headers: {
              "X-Campaign-UUID": campaign.uuid,
              "X-Subscriber-UUID": recipient.uuid,
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          });
          await campaignsRepository.recordSend(id, recipient.email, "sent", { subscriberId: recipient.id ?? undefined });
          if (fromDomain) await domainsService.recordSend(fromDomain);
          await mailboxesService.recordSend(campaign.fromEmail);
          sent += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await campaignsRepository.recordSend(id, recipient.email, "failed", {
            subscriberId: recipient.id ?? undefined,
            error: message,
          });
          console.error(`campaign ${campaign.id} send failed for recipient ${recipient.email}:`, err);
        }
      }

      if (sent > 0) await campaignsRepository.incrementSent(id, sent);
      if (!cappedForToday) await campaignsRepository.updateStatus(tenantId, id, "finished");
    } finally {
      activeDispatches.delete(id);
    }
  },
};
