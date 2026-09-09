import bcrypt from "bcryptjs";
import request from "supertest";
import type { Express } from "express";
import { prisma } from "../../src/config/prisma";
import { ALL_PERMISSIONS } from "../../src/common/permissions";

let counter = 0;
// A fresh, collision-free slug/hostname per call within a single test run —
// tenant.slug and TenantHostname.hostname are both globally unique.
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export interface TestTenant {
  tenant: Awaited<ReturnType<typeof prisma.tenant.create>>;
  hostname: string;
  user: Awaited<ReturnType<typeof prisma.user.create>>;
  password: string;
}

// Creates a tenant + hostname + a "Super Admin" role (all permissions,
// mirroring seed.ts's bootstrap) + one enabled user — everything a test
// needs to log in and exercise the full API as a real tenant admin.
export async function createTestTenant(opts?: { permissions?: string[] }): Promise<TestTenant> {
  const slug = unique("t");
  const hostname = `${slug}.test`;
  const tenant = await prisma.tenant.create({ data: { name: slug, slug, status: "active" } });
  await prisma.tenantHostname.create({ data: { tenantId: tenant.id, hostname, isPrimary: true } });
  const role = await prisma.role.create({
    data: { tenantId: tenant.id, name: "Super Admin", type: "user", permissions: opts?.permissions ?? ALL_PERMISSIONS },
  });
  const password = "testpassword123";
  const passwordHash = await bcrypt.hash(password, 4); // low cost factor — speed, not security, in tests
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      username: "admin",
      email: `admin@${hostname}`,
      passwordHash,
      type: "user",
      status: "enabled",
      roleId: role.id,
    },
  });
  return { tenant, hostname, user, password };
}

// Logs in as the tenant's admin via the real HTTP endpoint (Host header
// picks the tenant, same as a real request) and returns the session cookie
// to attach to subsequent requests — exercises the actual auth path rather
// than forging a JWT by hand.
export async function loginAs(app: Express, t: TestTenant): Promise<string> {
  const res = await request(app).post("/api/auth/login").set("Host", t.hostname).send({ username: t.user.username, password: t.password });
  if (res.status !== 200) throw new Error(`login failed for ${t.hostname}: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = res.headers["set-cookie"];
  if (!cookie) throw new Error("login succeeded but no Set-Cookie header was returned");
  return Array.isArray(cookie) ? cookie[0] : cookie;
}
