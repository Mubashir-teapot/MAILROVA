import { prisma } from "../../config/prisma";

export const suppressionsRepository = {
  findAll(tenantId: number) {
    return prisma.suppression.findMany({ where: { tenantId }, orderBy: { id: "desc" } });
  },

  findById(tenantId: number, id: number) {
    return prisma.suppression.findFirst({ where: { id, tenantId } });
  },

  upsert(tenantId: number, email: string, reason: string) {
    return prisma.suppression.upsert({
      where: { tenantId_email: { tenantId, email } },
      create: { tenantId, email, reason },
      update: { reason },
    });
  },

  remove(tenantId: number, id: number) {
    return prisma.suppression.delete({ where: { id, tenantId } });
  },
};
