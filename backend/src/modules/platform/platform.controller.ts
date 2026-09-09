import { Request, Response } from "express";
import { z } from "zod";
import { recordAudit } from "../../common/audit/auditLog";
import { setPlatformSessionCookie, clearPlatformSessionCookie } from "./platform.middleware";
import { platformService } from "./platform.service";
import { getAllPlatformSettings, setPlatformSetting } from "./platformSettings";

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  hostname: z.string().min(1),
  adminUsername: z.string().min(3),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

export const platformController = {
  async login(req: Request, res: Response) {
    const { username, password } = loginSchema.parse(req.body);
    const admin = await platformService.verifyAdmin(username, password);
    setPlatformSessionCookie(res, { id: admin.id, username: admin.username });
    res.json({ id: admin.id, username: admin.username });
  },

  async logout(_req: Request, res: Response) {
    clearPlatformSessionCookie(res);
    res.status(204).send();
  },

  async me(req: Request, res: Response) {
    res.json(req.platformAdmin);
  },

  async listTenants(_req: Request, res: Response) {
    res.json(await platformService.listTenants());
  },

  async createTenant(req: Request, res: Response) {
    const input = createTenantSchema.parse(req.body);
    const tenant = await platformService.createTenant(input);
    recordAudit({
      actorType: "platform_admin",
      actorId: req.platformAdmin!.id,
      actorLabel: req.platformAdmin!.username,
      action: "tenant.create",
      targetType: "tenant",
      targetId: tenant.id,
      meta: { name: tenant.name, slug: tenant.slug },
    });
    res.status(201).json(tenant);
  },

  async setStatus(req: Request, res: Response) {
    const { status } = z.object({ status: z.enum(["active", "suspended"]) }).parse(req.body);
    const id = Number(req.params.id);
    const tenant = await platformService.setStatus(id, status);
    recordAudit({
      actorType: "platform_admin",
      actorId: req.platformAdmin!.id,
      actorLabel: req.platformAdmin!.username,
      action: status === "suspended" ? "tenant.suspend" : "tenant.reactivate",
      targetType: "tenant",
      targetId: id,
      meta: { name: tenant.name },
    });
    res.json(tenant);
  },

  async addHostname(req: Request, res: Response) {
    const { hostname } = z.object({ hostname: z.string().min(1) }).parse(req.body);
    res.status(201).json(await platformService.addHostname(Number(req.params.id), hostname));
  },

  async removeHostname(req: Request, res: Response) {
    await platformService.removeHostname(Number(req.params.hostnameId));
    res.status(204).send();
  },

  async getSettings(_req: Request, res: Response) {
    const rows = await getAllPlatformSettings();
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  },

  async updateSettings(req: Request, res: Response) {
    const entries = z.record(z.unknown()).parse(req.body);
    for (const [key, value] of Object.entries(entries)) {
      await setPlatformSetting(key, value);
    }
    const rows = await getAllPlatformSettings();
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  },
};
