import { Request, Response } from "express";
import { z } from "zod";
import { listsService } from "./lists.service";

const listSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["public", "private"]).optional(),
  optin: z.enum(["single", "double"]).optional(),
  status: z.enum(["active", "archived"]).optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export const listsController = {
  async list(req: Request, res: Response) {
    res.json(await listsService.list(req.user!.tenantId));
  },

  async get(req: Request, res: Response) {
    res.json(await listsService.get(req.user!.tenantId, Number(req.params.id)));
  },

  async create(req: Request, res: Response) {
    const input = listSchema.parse(req.body);
    res.status(201).json(await listsService.create(req.user!.tenantId, input));
  },

  async update(req: Request, res: Response) {
    const input = listSchema.partial().parse(req.body);
    res.json(await listsService.update(req.user!.tenantId, Number(req.params.id), input));
  },

  async remove(req: Request, res: Response) {
    await listsService.remove(req.user!.tenantId, Number(req.params.id));
    res.status(204).send();
  },
};
