import { Campaign, CampaignStatus } from "@prisma/client";
import { ApiError } from "../../common/utils/ApiError";
import { prisma } from "../../config/prisma";
import { boss, SEND_EMAIL_QUEUE } from "../../common/queue/boss";
import { renderTemplate } from "../../common/utils/renderTemplate";
import { isUnsafeEmailHtml } from "../../common/utils/sanitizeEmailHtml";
import { domainsRepository } from "../domains/domains.repository";
import { mailboxesRepository } from "../mailboxes/mailboxes.repository";
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

// Shared by enqueueEligible() and preflight() — who a campaign would send to
// right now, deduped list-subscribers + still-eligible ad-hoc addresses.
async function resolveRecipients(tenantId: number, campaign: Campaign) {
  const listSubscribers = await campaignsRepository.findEligibleSubscribers(tenantId, campaign.id);
  const handled = await campaignsRepository.handledEmails(campaign.id);
  const suppressed = new Set(
    (await prisma.suppression.findMany({ where: { tenantId }, select: { email: true } })).map((s) => s.email)
  );
  const adhoc = (campaign.toEmails ?? []).filter(
    (email) => !listSubscribers.some((s) => s.email === email) && !handled.has(email) && !suppressed.has(email)
  );
  return { listSubscribers, adhoc };
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
      campaignsService.enqueueEligible(tenantId, id).catch((err) => console.error(`campaign ${id} enqueue failed:`, err));
    }

    return updated;
  },

  // Re-invoked by the scheduler for every "running" campaign each tick, so a
  // send that stalled on a warmup/mailbox cap (or was interrupted by a
  // restart) resumes on its own once quota is available again. Safe to call
  // repeatedly on the same campaign — every job carries a `singletonKey` of
  // `campaign:{id}:email:{email}`, so re-enqueuing a recipient that already
  // has a job in flight (or already has a terminal outcome, filtered out by
  // findEligibleSubscribers/handledEmails) is always a no-op.
  async enqueueEligible(tenantId: number, id: number) {
    const campaign = await campaignsService.get(tenantId, id);
    if (campaign.status !== "running") return;

    const { listSubscribers, adhoc } = await resolveRecipients(tenantId, campaign);
    const recipients = [
      ...listSubscribers.map((s) => ({ id: s.id as number | null, email: s.email })),
      ...adhoc.map((email) => ({ id: null as number | null, email })),
    ];

    for (const r of recipients) {
      await boss.send(
        SEND_EMAIL_QUEUE,
        { tenantId, campaignId: id, email: r.email, subscriberId: r.id },
        // `group` is what makes the worker's localGroupConcurrency:1 (see
        // campaigns.worker.ts) actually serialize sends per tenant.
        { singletonKey: `campaign:${id}:email:${r.email}`, group: { id: `tenant:${tenantId}` } }
      );
    }

    if (recipients.length === 0) {
      const stillPending = await campaignsRepository.hasPendingRecipients(tenantId, id, campaign.toEmails ?? []);
      if (!stillPending) await campaignsRepository.updateStatus(tenantId, id, "finished");
    }
  },

  // Checked before a campaign is allowed to send — errors block it, warnings
  // require the user to explicitly confirm anyway (see the Review wizard step).
  async preflight(tenantId: number, id: number) {
    const campaign = await campaignsService.get(tenantId, id);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!campaign.subject.trim()) errors.push("Subject is empty.");
    if (!campaign.body.trim()) errors.push("Content is empty.");
    if (isUnsafeEmailHtml(campaign.body)) errors.push("Content contains disallowed markup (script tags, event handlers, or javascript:/data: URLs).");

    const { listSubscribers, adhoc } = await resolveRecipients(tenantId, campaign);
    const recipientCount = listSubscribers.length + adhoc.length;
    if (recipientCount === 0) {
      errors.push("No eligible recipients — everyone targeted is already sent to, suppressed, or the lists/addresses are empty.");
    }

    const fromDomain = campaign.fromEmail.match(/@([^\s>]+)/)?.[1]?.toLowerCase();
    if (fromDomain) {
      const domain = await domainsRepository.findByName(fromDomain);
      if (domain) {
        const unverified = (["spfStatus", "dkimStatus", "dmarcStatus"] as const).filter((k) => domain[k] !== "verified");
        if (unverified.length) {
          warnings.push(`Sending domain "${fromDomain}" has unverified DNS records (${unverified.join(", ")}) — deliverability may suffer.`);
        }
      } else {
        warnings.push(`Sending domain "${fromDomain}" isn't a managed domain — no warmup ramp or DKIM signing will apply.`);
      }
    }

    const mailbox = await mailboxesRepository.findByEmail(campaign.fromEmail.toLowerCase());
    if (mailbox && !mailbox.enabled) errors.push(`Sending mailbox "${campaign.fromEmail}" is disabled.`);

    const sample = { Subscriber: { email: "preview@example.com", name: "Preview" }, Campaign: campaign, UnsubscribeUrl: "https://example.com/unsubscribe" };
    const renderedSubject = renderTemplate(campaign.subject, sample);
    const renderedBody = renderTemplate(campaign.body, sample);
    if (/\{\{|\}\}/.test(renderedSubject) || /\{\{|\}\}/.test(renderedBody)) {
      warnings.push("Some {{ variables }} in the subject or content didn't resolve — double-check they're spelled correctly.");
    }

    return { errors, warnings, recipientCount };
  },
};
