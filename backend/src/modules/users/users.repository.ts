import { prisma } from "../../config/prisma";
import { Prisma } from "@prisma/client";

const publicSelect = {
  id: true,
  uuid: true,
  username: true,
  email: true,
  type: true,
  status: true,
  roleId: true,
  role: true,
  totpEnabled: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const usersRepository = {
  findAll(tenantId: number) {
    return prisma.user.findMany({ where: { tenantId }, select: publicSelect, orderBy: { id: "asc" } });
  },
  findById(tenantId: number, id: number) {
    return prisma.user.findFirst({ where: { id, tenantId }, select: publicSelect });
  },
  findByUsernameOrEmail(tenantId: number, username: string, email: string) {
    return prisma.user.findFirst({ where: { tenantId, OR: [{ username }, { email }] } });
  },
  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data, select: publicSelect });
  },
  update(tenantId: number, id: number, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id, tenantId }, data, select: publicSelect });
  },
  remove(tenantId: number, id: number) {
    return prisma.user.delete({ where: { id, tenantId } });
  },
};
