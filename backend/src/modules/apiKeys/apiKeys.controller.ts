import { Request, Response } from "express";
import { z } from "zod";
import { recordAudit } from "../../common/audit/auditLog";
import { apiKeysService } from "./apiKeys.service";

const createSchema = z.object({ name: z.string().min(1).max(100) });

export const apiKeysController = {
  async list(req: Request, res: Response) {
    res.json(await apiKeysService.list(req.user!.tenantId));
  },

  async create(req: Request, res: Response) {
    const { name } = createSchema.parse(req.body);
    const created = await apiKeysService.create(req.user!.tenantId, req.user!.id, name);
    recordAudit({
      tenantId: req.user!.tenantId,
      actorType: "user",
      actorId: req.user!.id,
      actorLabel: req.user!.username,
      action: "api_key.create",
      targetType: "api_key",
      targetId: created.id,
      meta: { name: created.name },
    });
    res.status(201).json(created);
  },

  async revoke(req: Request, res: Response) {
    const id = Number(req.params.id);
    await apiKeysService.revoke(req.user!.tenantId, id);
    recordAudit({
      tenantId: req.user!.tenantId,
      actorType: "user",
      actorId: req.user!.id,
      actorLabel: req.user!.username,
      action: "api_key.revoke",
      targetType: "api_key",
      targetId: id,
    });
    res.status(204).send();
  },
};
