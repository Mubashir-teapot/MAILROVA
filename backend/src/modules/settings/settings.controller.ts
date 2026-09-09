import { Request, Response } from "express";
import { z } from "zod";
import { settingsService } from "./settings.service";

export const settingsController = {
  async get(req: Request, res: Response) {
    res.json(await settingsService.getAll(req.user!.tenantId));
  },

  async update(req: Request, res: Response) {
    const input = z.record(z.unknown()).parse(req.body);
    res.json(await settingsService.setMany(req.user!.tenantId, input));
  },
};
