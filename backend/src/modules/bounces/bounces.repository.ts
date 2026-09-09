import { prisma } from "../../config/prisma";
import { Prisma } from "@prisma/client";

export const bouncesRepository = {
  findAll(tenantId: number) {
    return prisma.bounce.findMany({
      where: { tenantId },
      orderBy: { id: "desc" },
      include: { subscriber: true, campaign: true },
    });
  },
  countByType(subscriberId: number, type: Prisma.BounceWhereInput["type"]) {
    return prisma.bounce.count({ where: { subscriberId, type } });
  },
  create(data: Prisma.BounceCreateInput) {
    return prisma.bounce.create({ data });
  },
  remove(tenantId: number, id: number) {
    return prisma.bounce.delete({ where: { id, tenantId } });
  },
};
