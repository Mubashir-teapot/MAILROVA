import { Request, Response } from "express";
import { z } from "zod";
import { rolesService } from "./roles.service";

const roleSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["user", "list"]).optional(),
  permissions: z.array(z.string()).optional(),
});

export const rolesController = {
  async list(req: Request, res: Response) {
    res.json(await rolesService.list(req.user!.tenantId));
  },

  async get(req: Request, res: Response) {
    res.json(await rolesService.get(req.user!.tenantId, Number(req.params.id)));
  },

  async create(req: Request, res: Response) {
    const input = roleSchema.parse(req.body);
    res.status(201).json(await rolesService.create(req.user!.tenantId, input));
  },

  async update(req: Request, res: Response) {
    const input = roleSchema.partial().parse(req.body);
    res.json(await rolesService.update(req.user!.tenantId, Number(req.params.id), input));
  },

  async remove(req: Request, res: Response) {
    await rolesService.remove(req.user!.tenantId, Number(req.params.id));
    res.status(204).send();
  },
};
