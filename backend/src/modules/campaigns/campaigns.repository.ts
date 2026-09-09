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

  incrementSent(id: number, count: number) {
    return prisma.campaign.update({ where: { id }, data: { sent: { increment: count } } });
  },

  remove(tenantId: number, id: number) {
    return prisma.campaign.delete({ where: { id, tenantId } });
  },

  // Subscribers eligible for this campaign: enabled, on one of its lists,
  // either `unconfirmed`/`confirmed` on a single opt-in list or `confirmed`
  // on a double opt-in list, not suppressed, and not already sent to (so
  // pause/resume/warmup deferral never double-sends).
  async findEligibleSubscribers(tenantId: number, campaignId: number) {
    const [campaignLists, alreadySent, suppressed] = await Promise.all([
      prisma.campaignList.findMany({ where: { campaignId }, include: { list: true } }),
      prisma.campaignSend.findMany({ where: { campaignId }, select: { email: true } }),
      prisma.suppression.findMany({ where: { tenantId }, select: { email: true } }),
    ]);
    const sentEmails = new Set(alreadySent.map((s) => s.email));
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

  alreadySentEmails(campaignId: number) {
    return prisma.campaignSend
      .findMany({ where: { campaignId }, select: { email: true } })
      .then((rows) => new Set(rows.map((r) => r.email)));
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
