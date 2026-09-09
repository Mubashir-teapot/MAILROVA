import { prisma } from "../../config/prisma";

export const platformRepository = {
  findAdminByUsername(username: string) {
    return prisma.platformAdmin.findUnique({ where: { username } });
  },

  listTenants() {
    return prisma.tenant.findMany({
      orderBy: { id: "asc" },
      include: { hostnames: true, _count: { select: { users: true, domains: true } } },
    });
  },

  findTenant(id: number) {
    return prisma.tenant.findUnique({ where: { id }, include: { hostnames: true } });
  },

  createTenant(name: string, slug: string) {
    return prisma.tenant.create({ data: { name, slug } });
  },

  setTenantStatus(id: number, status: "active" | "suspended") {
    return prisma.tenant.update({ where: { id }, data: { status } });
  },

  addHostname(tenantId: number, hostname: string, isPrimary: boolean) {
    return prisma.tenantHostname.create({ data: { tenantId, hostname, isPrimary } });
  },

  removeHostname(id: number) {
    return prisma.tenantHostname.delete({ where: { id } });
  },
};
