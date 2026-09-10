import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { ALL_PERMISSIONS } from "../src/common/permissions";

const prisma = new PrismaClient();

function randomPassword() {
  return crypto.randomBytes(12).toString("base64url");
}

async function main() {
  // ---- Platform admin (manages tenants; separate from any tenant's users) ----
  const platformUsername = process.env.PLATFORM_ADMIN_USERNAME || "platform-admin";
  const existingPlatformAdmin = await prisma.platformAdmin.findUnique({ where: { username: platformUsername } });

  if (!existingPlatformAdmin) {
    const platformPassword = process.env.PLATFORM_ADMIN_PASSWORD || randomPassword();
    const passwordHash = await bcrypt.hash(platformPassword, 10);
    await prisma.platformAdmin.create({ data: { username: platformUsername, passwordHash } });
    console.log("─".repeat(60));
    console.log(`Platform admin created — sign in at /platform/login`);
    console.log(`  username: ${platformUsername}`);
    if (!process.env.PLATFORM_ADMIN_PASSWORD) {
      console.log(`  password: ${platformPassword}  (generated — save this, it will not be shown again)`);
    }
    console.log("─".repeat(60));
  }

  // ---- First tenant (only bootstrapped once) — additional tenants are
  // created later from the platform admin UI, not here. ----
  let tenant = await prisma.tenant.findFirst();

  if (!tenant) {
    const tenantName = process.env.DEFAULT_TENANT_NAME || "My Organization";
    const tenantSlug = process.env.DEFAULT_TENANT_SLUG || "default";
    const tenantHostname = (process.env.DEFAULT_TENANT_HOSTNAME || "localhost").toLowerCase();

    tenant = await prisma.tenant.create({ data: { name: tenantName, slug: tenantSlug } });
    await prisma.tenantHostname.create({ data: { tenantId: tenant.id, hostname: tenantHostname, isPrimary: true } });

    await prisma.template.create({
      data: {
        tenantId: tenant.id,
        name: "Default template",
        type: "campaign",
        body: "{{Campaign.Subject}}",
        isDefault: true,
      },
    });

    await prisma.setting.create({
      data: {
        tenantId: tenant.id,
        key: "bounce.actions",
        value: {
          soft: { count: 2, action: "none" },
          hard: { count: 1, action: "blocklist" },
          complaint: { count: 1, action: "blocklist" },
        },
      },
    });

    console.log(`Tenant "${tenantName}" created, reachable at host "${tenantHostname}".`);
  }

  // ---- Admin user — .env is the source of truth on every deploy, not just
  // the first. Without this, a password set (or auto-generated and lost)
  // before ADMIN_PASSWORD existed in .env would silently outlive every
  // later .env change, since this used to only ever run once. ----
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@mailrova.local";

  const superAdminRole =
    (await prisma.role.findFirst({ where: { tenantId: tenant.id, name: "Super Admin" } })) ??
    (await prisma.role.create({
      data: { tenantId: tenant.id, name: "Super Admin", type: "user", permissions: ALL_PERMISSIONS },
    }));

  const existingAdmin = await prisma.user.findUnique({
    where: { tenantId_username: { tenantId: tenant.id, username: adminUsername } },
  });

  if (!existingAdmin) {
    const adminPassword = process.env.ADMIN_PASSWORD || randomPassword();
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        username: adminUsername,
        email: adminEmail,
        passwordHash,
        type: "user",
        status: "enabled",
        roleId: superAdminRole.id,
      },
    });
    console.log("─".repeat(60));
    console.log(`Admin user "${adminUsername}" created — sign in at /admin/login`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`  password: ${adminPassword}  (generated — save this, it will not be shown again)`);
    }
    console.log("─".repeat(60));
  } else if (process.env.ADMIN_PASSWORD) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { email: adminEmail, passwordHash, status: "enabled" },
    });
    console.log(`Admin user "${adminUsername}" password synced from ADMIN_PASSWORD — sign in at /admin/login`);
  } else {
    console.log(`Admin user "${adminUsername}" already exists — set ADMIN_PASSWORD in .env to force-sync it.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
