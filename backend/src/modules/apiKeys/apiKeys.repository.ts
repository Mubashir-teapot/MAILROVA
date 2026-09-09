import { prisma } from "../../config/prisma";

export const apiKeysRepository = {
  findAll(tenantId: number) {
    return prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { id: "desc" },
      select: { id: true, uuid: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true, revokedAt: true },
    });
  },

  findById(tenantId: number, id: number) {
    return prisma.apiKey.findFirst({ where: { id, tenantId } });
  },

  // Scoped by tenantId too even though keyPrefix is already globally unique —
  // same defense-in-depth pattern as everywhere else a row is looked up by id.
  findActiveByPrefix(tenantId: number, keyPrefix: string) {
    return prisma.apiKey.findFirst({
      where: { tenantId, keyPrefix, revokedAt: null },
      include: { user: { include: { role: true } } },
    });
  },

  create(data: { tenantId: number; userId: number; name: string; keyPrefix: string; keyHash: string }) {
    return prisma.apiKey.create({ data });
  },

  touchLastUsed(id: number) {
    return prisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() } });
  },

  revoke(tenantId: number, id: number) {
    return prisma.apiKey.update({ where: { id, tenantId }, data: { revokedAt: new Date() } });
  },
};
