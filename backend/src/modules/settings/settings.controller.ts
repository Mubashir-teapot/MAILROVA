import { Request, Response } from "express";
import { z } from "zod";
import { recordAudit } from "../../common/audit/auditLog";
import { settingsService } from "./settings.service";

export const settingsController = {
  async get(req: Request, res: Response) {
    res.json(await settingsService.getAll(req.user!.tenantId));
  },

  async update(req: Request, res: Response) {
    const input = z.record(z.unknown()).parse(req.body);
    const result = await settingsService.setMany(req.user!.tenantId, input);
    recordAudit({
      tenantId: req.user!.tenantId,
      actorType: "user",
      actorId: req.user!.id,
      actorLabel: req.user!.username,
      action: "settings.update",
      meta: { keys: Object.keys(input) },
    });
    res.json(result);
  },
};
