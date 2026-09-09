import { prisma } from "../../config/prisma";

export const authRepository = {
  findByUsername(tenantId: number, username: string) {
    return prisma.user.findUnique({ where: { tenantId_username: { tenantId, username } }, include: { role: true } });
  },
  findById(tenantId: number, id: number) {
    return prisma.user.findFirst({ where: { id, tenantId }, include: { role: true } });
  },
};
