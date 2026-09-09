import { prisma } from "../../config/prisma";
import { Prisma } from "@prisma/client";

export const rolesRepository = {
  findAll(tenantId: number) {
    return prisma.role.findMany({ where: { tenantId }, orderBy: { id: "asc" } });
  },
  findById(tenantId: number, id: number) {
    return prisma.role.findFirst({ where: { id, tenantId } });
  },
  create(data: Prisma.RoleCreateInput) {
    return prisma.role.create({ data });
  },
  update(tenantId: number, id: number, data: Prisma.RoleUpdateInput) {
    return prisma.role.update({ where: { id, tenantId }, data });
  },
  remove(tenantId: number, id: number) {
    return prisma.role.delete({ where: { id, tenantId } });
  },
};
