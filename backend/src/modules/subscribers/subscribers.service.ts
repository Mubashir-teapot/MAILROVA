import { Prisma, SubscriptionStatus } from "@prisma/client";
import { ApiError } from "../../common/utils/ApiError";
import { sendMail } from "../../common/mail/mailer";
import { prisma } from "../../config/prisma";
import { subscribersRepository } from "./subscribers.repository";

export interface SubscriberInput {
  email: string;
  name: string;
  status?: "enabled" | "disabled" | "blocklisted";
  attribs?: Record<string, unknown>;
  listIds?: number[];
}

export const subscribersService = {
  async list(tenantId: number, page = 1, perPage = 20, search?: string) {
    const [results, total] = await subscribersRepository.findAll(tenantId, { page, perPage, search });
    return { results, total, page, perPage };
  },

  async get(tenantId: number, id: number) {
    const subscriber = await subscribersRepository.findById(tenantId, id);
    if (!subscriber) throw ApiError.notFound("Subscriber not found");
    return subscriber;
  },

  async create(tenantId: number, input: SubscriberInput) {
    const existing = await subscribersRepository.findByEmail(tenantId, input.email);
    if (existing) throw ApiError.conflict("Subscriber with this email already exists");

    const subscriber = await subscribersRepository.create({
      tenant: { connect: { id: tenantId } },
      email: input.email.toLowerCase().trim(),
      name: input.name,
      status: input.status ?? "enabled",
      attribs: (input.attribs ?? {}) as Prisma.InputJsonValue,
    });

    if (input.listIds?.length) {
      await subscribersService.subscribeToLists(tenantId, subscriber.id, input.listIds);
    }

    return subscribersService.get(tenantId, subscriber.id);
  },

  async update(tenantId: number, id: number, input: Partial<SubscriberInput>) {
    await subscribersService.get(tenantId, id);
    await subscribersRepository.update(tenantId, id, {
      email: input.email?.toLowerCase().trim(),
      name: input.name,
      status: input.status,
      attribs: input.attribs as Prisma.InputJsonValue | undefined,
    });
    if (input.listIds) {
      await subscribersService.subscribeToLists(tenantId, id, input.listIds);
    }
    return subscribersService.get(tenantId, id);
  },

  async remove(tenantId: number, id: number) {
    await subscribersService.get(tenantId, id);
    await subscribersRepository.remove(tenantId, id);
  },

  // Adds the subscriber to each list as `unconfirmed`, then — for double opt-in
  // lists only — e-mails a confirmation link. Single opt-in lists need no e-mail.
  async subscribeToLists(tenantId: number, subscriberId: number, listIds: number[]) {
    const subscriber = await subscribersRepository.findById(tenantId, subscriberId);
    if (!subscriber) throw ApiError.notFound("Subscriber not found");

    const status: SubscriptionStatus = subscriber.status === "blocklisted" ? "unsubscribed" : "unconfirmed";

    for (const listId of listIds) {
      await subscribersRepository.setListMembership(subscriberId, listId, status);
    }

    if (status === "unconfirmed") {
      const doubleOptinLists = await prisma.list.findMany({
        where: { id: { in: listIds }, tenantId, optin: "double" },
      });
      if (doubleOptinLists.length) {
        await sendMail({
          to: subscriber.email,
          subject: "Please confirm your subscription",
          html: `<p>Hi ${subscriber.name || subscriber.email},</p>
                 <p>Please confirm your subscription to: ${doubleOptinLists.map((l) => l.name).join(", ")}.</p>
                 <p><a href="${confirmUrl(subscriber.uuid)}">Confirm subscription</a></p>`,
        });
      }
    }
  },

  async unsubscribeFromList(tenantId: number, subscriberId: number, listId: number) {
    await subscribersService.get(tenantId, subscriberId);
    await subscribersRepository.setListMembership(subscriberId, listId, "unsubscribed");
  },

  async confirmSubscription(tenantId: number, subscriberUuid: string, listIds: number[]) {
    const subscriber = await prisma.subscriber.findFirst({ where: { uuid: subscriberUuid, tenantId } });
    if (!subscriber) throw ApiError.notFound("Subscriber not found");
    for (const listId of listIds) {
      await subscribersRepository.setListMembership(subscriber.id, listId, "confirmed");
    }
  },

  async blocklist(tenantId: number, id: number) {
    await subscribersService.get(tenantId, id);
    await subscribersRepository.update(tenantId, id, { status: "blocklisted" });
    await prisma.subscriberList.updateMany({
      where: { subscriberId: id },
      data: { status: "unsubscribed" },
    });
  },
};

function confirmUrl(subscriberUuid: string) {
  return `${process.env.PUBLIC_URL ?? "http://localhost:4000"}/api/public/optin/${subscriberUuid}`;
}
