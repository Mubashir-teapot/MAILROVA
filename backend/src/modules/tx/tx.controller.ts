import { Request, Response } from "express";
import { z } from "zod";
import { txService } from "./tx.service";

const txSchema = z.object({
  templateId: z.number().int(),
  subscriberEmail: z.string().email().optional(),
  subscriberId: z.number().int().optional(),
  subject: z.string().optional(),
  fromEmail: z.string().email().optional(),
  data: z.record(z.unknown()).optional(),
});

export const txController = {
  async send(req: Request, res: Response) {
    const input = txSchema.parse(req.body);
    res.json({ data: await txService.send(req.user!.tenantId, input) });
  },
};
