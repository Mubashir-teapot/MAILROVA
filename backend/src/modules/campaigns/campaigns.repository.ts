import { prisma } from "../../config/prisma";
import { CampaignStatus, Prisma, SendStatus } from "@prisma/client";

const withLists = { lists: { include: { list: true } }, template: true } satisfies Prisma.CampaignInclude;

export const campaignsRepository = {
  findAll(tenantId: number) {
    return prisma.campaign.findMany({ where: { tenantId }, orderBy: { id: "desc" }, include: withLists });
  },

  findById(tenantId: number, id: number) {
    return prisma.campaign.findFirst({ where: { id, tenantId }, include: withLists });
  },

  create(tenantId: number, data: Prisma.CampaignCreateInput, listIds: number[]) {
    return prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({ data });
      if (listIds.length) {
        const lists = await tx.list.findMany({ where: { id: { in: listIds }, tenantId } });
        await tx.campaignList.createMany({
          data: lists.map((l) => ({ campaignId: campaign.id, listId: l.id, listName: l.name })),
        });
      }
      return tx.campaign.findUniqueOrThrow({ where: { id: campaign.id }, include: withLists });
    });
  },

  async update(tenantId: number, id: number, data: Prisma.CampaignUpdateInput, listIds?: number[]) {
    return prisma.$transaction(async (tx) => {
      await tx.campaign.update({ where: { id, tenantId }, data });
      if (listIds) {
        await tx.campaignList.deleteMany({ where: { campaignId: id } });
        const lists = await tx.list.findMany({ where: { id: { in: listIds }, tenantId } });
        await tx.campaignList.createMany({
          data: lists.map((l) => ({ campaignId: id, listId: l.id, listName: l.name })),
        });
      }
      return tx.campaign.findUniqueOrThrow({ where: { id }, include: withLists });
    });
  },

  updateStatus(tenantId: number, id: number, status: CampaignStatus) {
    return prisma.campaign.update({ where: { id, tenantId }, data: { status } });
  },

  incrementSent(tenantId: number, id: number, count: number) {
    return prisma.campaign.update({ where: { id, tenantId }, data: { sent: { increment: count } } });
  },

  remove(tenantId: number, id: number) {
    return prisma.campaign.delete({ where: { id, tenantId } });
  },

  // Subscribers eligible for this campaign: enabled, on one of its lists,
  // either `unconfirmed`/`confirmed` on a single opt-in list or `confirmed`
  // on a double opt-in list, not suppressed, and not already terminally
  // handled (sent/bounced/undeliverable — NOT `failed`, which is still
  // within its retry budget, see queue/boss.ts) so pause/resume/warmup
  // deferral never double-sends, but a transient failure still gets retried.
  async findEligibleSubscribers(tenantId: number, campaignId: number) {
    const [campaignLists, handled, suppressed] = await Promise.all([
      prisma.campaignList.findMany({ where: { campaignId }, include: { list: true } }),
      prisma.campaignSend.findMany({ where: { campaignId, status: { in: ["sent", "bounced", "undeliverable"] } }, select: { email: true } }),
      prisma.suppression.findMany({ where: { tenantId }, select: { email: true } }),
    ]);
    const sentEmails = new Set(handled.map((s) => s.email));
    const suppressedEmails = new Set(suppressed.map((s) => s.email));

    const seenEmails = new Set<string>();
    const subscribers = [];

    for (const cl of campaignLists) {
      const memberships = await prisma.subscriberList.findMany({
        where: {
          listId: cl.listId,
          status: cl.list.optin === "double" ? "confirmed" : { in: ["confirmed", "unconfirmed"] },
          subscriber: { status: "enabled" },
        },
        include: { subscriber: true },
      });

      for (const m of memberships) {
        const email = m.subscriber.email;
        if (!seenEmails.has(email) && !sentEmails.has(email) && !suppressedEmails.has(email)) {
          seenEmails.add(email);
          subscribers.push(m.subscriber);
        }
      }
    }

    return subscribers;
  },

  // Terminal outcomes only — see findEligibleSubscribers' comment.
  handledEmails(campaignId: number) {
    return prisma.campaignSend
      .findMany({ where: { campaignId, status: { in: ["sent", "bounced", "undeliverable"] } }, select: { email: true } })
      .then((rows) => new Set(rows.map((r) => r.email)));
  },

  // Whether this campaign still has any target recipient (list-derived or
  // ad-hoc) without a terminal outcome yet — used to decide when a "running"
  // campaign is actually done (see campaigns.worker.ts's completion check).
  async hasPendingRecipients(tenantId: number, campaignId: number, toEmails: string[]) {
    const eligible = await campaignsRepository.findEligibleSubscribers(tenantId, campaignId);
    if (eligible.length > 0) return true;
    if (!toEmails.length) return false;
    const [handled, suppressed] = await Promise.all([
      campaignsRepository.handledEmails(campaignId),
      prisma.suppression.findMany({ where: { tenantId, email: { in: toEmails } }, select: { email: true } }),
    ]);
    const suppressedEmails = new Set(suppressed.map((s) => s.email));
    return toEmails.some((email) => !handled.has(email) && !suppressedEmails.has(email));
  },

  recordSend(campaignId: number, email: string, status: SendStatus, opts?: { subscriberId?: number; error?: string }) {
    return prisma.campaignSend.upsert({
      where: { campaignId_email: { campaignId, email } },
      create: { campaignId, email, status, subscriberId: opts?.subscriberId, error: opts?.error },
      update: { status, error: opts?.error },
    });
  },

  deliveryLog(tenantId: number, campaignId: number) {
    return prisma.campaignSend.findMany({
      where: { campaignId, campaign: { tenantId } },
      orderBy: { sentAt: "desc" },
      take: 500,
    });
  },
};
