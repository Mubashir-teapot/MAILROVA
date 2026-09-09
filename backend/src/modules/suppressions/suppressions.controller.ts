import { Request, Response } from "express";
import { z } from "zod";
import { suppressionsService } from "./suppressions.service";

const addSchema = z.object({ email: z.string().email() });

export const suppressionsController = {
  async list(req: Request, res: Response) {
    res.json(await suppressionsService.list(req.user!.tenantId));
  },

  async add(req: Request, res: Response) {
    const { email } = addSchema.parse(req.body);
    res.status(201).json(await suppressionsService.add(req.user!.tenantId, email));
  },

  async remove(req: Request, res: Response) {
    await suppressionsService.remove(req.user!.tenantId, Number(req.params.id));
    res.status(204).send();
  },
};
