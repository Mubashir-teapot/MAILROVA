import { prisma } from "../../config/prisma";
import { Prisma } from "@prisma/client";

export const templatesRepository = {
  findAll(tenantId: number) {
    return prisma.template.findMany({ where: { tenantId }, orderBy: { id: "asc" } });
  },
  findById(tenantId: number, id: number) {
    return prisma.template.findFirst({ where: { id, tenantId } });
  },
  create(data: Prisma.TemplateCreateInput) {
    return prisma.template.create({ data });
  },
  update(tenantId: number, id: number, data: Prisma.TemplateUpdateInput) {
    return prisma.template.update({ where: { id, tenantId }, data });
  },
  remove(tenantId: number, id: number) {
    return prisma.template.delete({ where: { id, tenantId } });
  },
  clearDefault(tenantId: number) {
    return prisma.template.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
  },
  countAll(tenantId: number) {
    return prisma.template.count({ where: { tenantId } });
  },
};
