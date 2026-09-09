import { prisma } from "../../config/prisma";
import { ApiError } from "../../common/utils/ApiError";
import { verifyUnsubscribeToken } from "../../common/utils/unsubscribeToken";
import { subscribersService } from "../subscribers/subscribers.service";

export const publicService = {
  listPublicLists(tenantId: number) {
    return prisma.list.findMany({
      where: { tenantId, type: "public", status: "active" },
      select: { uuid: true, name: true },
    });
  },

  async subscribe(tenantId: number, email: string, name: string, listUuids: string[]) {
    const lists = await prisma.list.findMany({ where: { tenantId, uuid: { in: listUuids }, type: "public" } });
    if (!lists.length) throw ApiError.badRequest("No valid lists given");

    let subscriber = await prisma.subscriber.findUnique({ where: { tenantId_email: { tenantId, email: email.toLowerCase() } } });
    if (!subscriber) {
      subscriber = await prisma.subscriber.create({
        data: { tenantId, email: email.toLowerCase(), name: name || email.split("@")[0], status: "enabled" },
      });
    }

    await subscribersService.subscribeToLists(
      tenantId,
      subscriber.id,
      lists.map((l) => l.id)
    );
  },

  async confirmOptin(tenantId: number, subscriberUuid: string) {
    const subscriber = await prisma.subscriber.findFirst({
      where: { uuid: subscriberUuid, tenantId },
      include: { lists: { where: { status: "unconfirmed" }, include: { list: true } } },
    });
    if (!subscriber) throw ApiError.notFound("Subscriber not found");

    const listIds = subscriber.lists.filter((l) => l.list.optin === "double").map((l) => l.listId);
    await subscribersService.confirmSubscription(tenantId, subscriberUuid, listIds);
    return { confirmed: listIds.length };
  },

  async unsubscribe(tenantId: number, subscriberUuid: string, listUuid: string) {
    const subscriber = await prisma.subscriber.findFirst({ where: { uuid: subscriberUuid, tenantId } });
    const list = await prisma.list.findFirst({ where: { uuid: listUuid, tenantId } });
    if (!subscriber || !list) throw ApiError.notFound("Subscriber or list not found");
    await subscribersService.unsubscribeFromList(tenantId, subscriber.id, list.id);
  },

  // One-click unsubscribe from the link embedded in every campaign send (see
  // campaigns.service.ts) — a global opt-out (Suppression), not per-list,
  // since that's what the List-Unsubscribe header/link is expected to do.
  async unsubscribeByToken(tenantId: number, email: string, token: string) {
    if (!verifyUnsubscribeToken(tenantId, email, token)) throw ApiError.unauthorized("Invalid unsubscribe link");

    const lower = email.toLowerCase();
    await prisma.suppression.upsert({
      where: { tenantId_email: { tenantId, email: lower } },
      create: { tenantId, email: lower, reason: "unsubscribe" },
      update: { reason: "unsubscribe" },
    });

    const subscriber = await prisma.subscriber.findUnique({ where: { tenantId_email: { tenantId, email: lower } } });
    if (subscriber) {
      await prisma.subscriberList.updateMany({ where: { subscriberId: subscriber.id }, data: { status: "unsubscribed" } });
    }
  },
};
