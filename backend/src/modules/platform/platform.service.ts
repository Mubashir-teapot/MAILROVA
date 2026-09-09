import bcrypt from "bcryptjs";
import { ApiError } from "../../common/utils/ApiError";
import { ALL_PERMISSIONS } from "../../common/permissions";
import { prisma } from "../../config/prisma";
import { platformRepository } from "./platform.repository";

export const platformService = {
  async verifyAdmin(username: string, password: string) {
    const admin = await platformRepository.findAdminByUsername(username);
    if (!admin) throw ApiError.unauthorized("Invalid credentials");
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw ApiError.unauthorized("Invalid credentials");
    return admin;
  },

  listTenants() {
    return platformRepository.listTenants();
  },

  // Provisions a brand-new tenant end to end: the org itself, its first
  // hostname, a Super Admin role with every permission, and its first user —
  // the same bootstrap the seed script does for tenant #1, callable anytime.
  async createTenant(input: { name: string; slug: string; hostname: string; adminUsername: string; adminEmail: string; adminPassword: string }) {
    const slug = input.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) throw ApiError.badRequest("Slug must be lowercase letters, numbers, and hyphens");

    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: input.name, slug } });

      await tx.tenantHostname.create({
        data: { tenantId: tenant.id, hostname: input.hostname.toLowerCase(), isPrimary: true },
      });

      const role = await tx.role.create({
        data: { tenantId: tenant.id, name: "Super Admin", type: "user", permissions: ALL_PERMISSIONS },
      });

      const passwordHash = await bcrypt.hash(input.adminPassword, 10);
      await tx.user.create({
        data: {
          tenantId: tenant.id,
          username: input.adminUsername,
          email: input.adminEmail,
          passwordHash,
          type: "user",
          status: "enabled",
          roleId: role.id,
        },
      });

      return tenant;
    });
  },

  async setStatus(id: number, status: "active" | "suspended") {
    const tenant = await platformRepository.findTenant(id);
    if (!tenant) throw ApiError.notFound("Tenant not found");
    return platformRepository.setTenantStatus(id, status);
  },

  async addHostname(tenantId: number, hostname: string) {
    const tenant = await platformRepository.findTenant(tenantId);
    if (!tenant) throw ApiError.notFound("Tenant not found");
    return platformRepository.addHostname(tenantId, hostname.toLowerCase(), false);
  },

  removeHostname(id: number) {
    return platformRepository.removeHostname(id);
  },
};
