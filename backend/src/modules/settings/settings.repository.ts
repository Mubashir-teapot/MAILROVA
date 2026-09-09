import { prisma } from "../../config/prisma";
import { Prisma } from "@prisma/client";

export const settingsRepository = {
  findAll(tenantId: number) {
    return prisma.setting.findMany({ where: { tenantId } });
  },
  upsert(tenantId: number, key: string, value: Prisma.InputJsonValue) {
    return prisma.setting.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, value },
      update: { value },
    });
  },
};
