import { Request, Response } from "express";
import { z } from "zod";
import { apiKeysService } from "./apiKeys.service";

const createSchema = z.object({ name: z.string().min(1).max(100) });

export const apiKeysController = {
  async list(req: Request, res: Response) {
    res.json(await apiKeysService.list(req.user!.tenantId));
  },

  async create(req: Request, res: Response) {
    const { name } = createSchema.parse(req.body);
    res.status(201).json(await apiKeysService.create(req.user!.tenantId, req.user!.id, name));
  },

  async revoke(req: Request, res: Response) {
    await apiKeysService.revoke(req.user!.tenantId, Number(req.params.id));
    res.status(204).send();
  },
};
