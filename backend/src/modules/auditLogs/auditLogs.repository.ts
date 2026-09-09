import { prisma } from "../../config/prisma";

export const auditLogsRepository = {
  findAll(tenantId: number, take = 200) {
    return prisma.auditLog.findMany({ where: { tenantId }, orderBy: { id: "desc" }, take });
  },
};
