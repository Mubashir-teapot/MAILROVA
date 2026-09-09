import { prisma } from "../../config/prisma";
import { Prisma } from "@prisma/client";

export const listsRepository = {
  findAll(tenantId: number) {
    return prisma.list.findMany({
      where: { tenantId },
      orderBy: { id: "asc" },
      include: { _count: { select: { subscribers: true } } },
    });
  },
  findById(tenantId: number, id: number) {
    return prisma.list.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { subscribers: true } } },
    });
  },
  create(data: Prisma.ListCreateInput) {
    return prisma.list.create({ data });
  },
  update(tenantId: number, id: number, data: Prisma.ListUpdateInput) {
    return prisma.list.update({ where: { id, tenantId }, data });
  },
  remove(tenantId: number, id: number) {
    return prisma.list.delete({ where: { id, tenantId } });
  },
};
