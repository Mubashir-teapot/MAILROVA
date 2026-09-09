import { prisma } from "../../config/prisma";
import { Prisma, SubscriptionStatus } from "@prisma/client";

const withLists = { lists: { include: { list: true } } } satisfies Prisma.SubscriberInclude;

export const subscribersRepository = {
  findAll(tenantId: number, params: { page: number; perPage: number; search?: string }) {
    const where: Prisma.SubscriberWhereInput = {
      tenantId,
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: "insensitive" } },
              { name: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return prisma.$transaction([
      prisma.subscriber.findMany({
        where,
        include: withLists,
        orderBy: { id: "asc" },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
      prisma.subscriber.count({ where }),
    ]);
  },

  findById(tenantId: number, id: number) {
    return prisma.subscriber.findFirst({ where: { id, tenantId }, include: withLists });
  },

  findByEmail(tenantId: number, email: string) {
    return prisma.subscriber.findUnique({ where: { tenantId_email: { tenantId, email } } });
  },

  create(data: Prisma.SubscriberCreateInput) {
    return prisma.subscriber.create({ data, include: withLists });
  },

  update(tenantId: number, id: number, data: Prisma.SubscriberUpdateInput) {
    return prisma.subscriber.update({ where: { id, tenantId }, data, include: withLists });
  },

  remove(tenantId: number, id: number) {
    return prisma.subscriber.delete({ where: { id, tenantId } });
  },

  setListMembership(subscriberId: number, listId: number, status: SubscriptionStatus) {
    return prisma.subscriberList.upsert({
      where: { subscriberId_listId: { subscriberId, listId } },
      create: { subscriberId, listId, status },
      update: { status },
    });
  },

  removeListMembership(subscriberId: number, listId: number) {
    return prisma.subscriberList.delete({
      where: { subscriberId_listId: { subscriberId, listId } },
    });
  },
};
