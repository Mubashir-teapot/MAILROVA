import { Request, Response } from "express";
import { z } from "zod";
import { bouncesService } from "./bounces.service";

const bounceSchema = z.object({
  email: z.string().email().optional(),
  subscriberUuid: z.string().uuid().optional(),
  campaignId: z.number().int().optional(),
  type: z.enum(["hard", "soft", "complaint"]),
  source: z.string().min(1),
  meta: z.record(z.unknown()).optional(),
});

export const bouncesController = {
  async list(req: Request, res: Response) {
    res.json(await bouncesService.list(req.user!.tenantId));
  },

  async record(req: Request, res: Response) {
    const input = bounceSchema.parse(req.body);
    res.status(201).json(await bouncesService.record({ ...input, tenantId: req.user!.tenantId }));
  },

  async remove(req: Request, res: Response) {
    await bouncesService.remove(req.user!.tenantId, Number(req.params.id));
    res.status(204).send();
  },
};
