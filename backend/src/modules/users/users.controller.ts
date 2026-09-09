import { Request, Response } from "express";
import { z } from "zod";
import { usersService } from "./users.service";

const userSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  type: z.enum(["user", "api"]).optional(),
  roleId: z.number().int().optional(),
});

export const usersController = {
  async list(req: Request, res: Response) {
    res.json(await usersService.list(req.user!.tenantId));
  },

  async get(req: Request, res: Response) {
    res.json(await usersService.get(req.user!.tenantId, Number(req.params.id)));
  },

  async create(req: Request, res: Response) {
    const input = userSchema.parse(req.body);
    res.status(201).json(await usersService.create(req.user!.tenantId, input));
  },

  async update(req: Request, res: Response) {
    const input = userSchema.partial().parse(req.body);
    res.json(await usersService.update(req.user!.tenantId, Number(req.params.id), input));
  },

  async remove(req: Request, res: Response) {
    await usersService.remove(req.user!.tenantId, Number(req.params.id));
    res.status(204).send();
  },
};
