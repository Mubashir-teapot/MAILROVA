import { prisma } from "../../config/prisma";
import { Prisma } from "@prisma/client";

export const mediaRepository = {
  findAll(tenantId: number) {
    return prisma.media.findMany({ where: { tenantId }, orderBy: { id: "desc" } });
  },
  findById(tenantId: number, id: number) {
    return prisma.media.findFirst({ where: { id, tenantId } });
  },
  create(data: Prisma.MediaCreateInput) {
    return prisma.media.create({ data });
  },
  remove(tenantId: number, id: number) {
    return prisma.media.delete({ where: { id, tenantId } });
  },
};
