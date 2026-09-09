import { Request, Response } from "express";
import { z } from "zod";
import { recordAudit } from "../../common/audit/auditLog";
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
    const user = await usersService.create(req.user!.tenantId, input);
    recordAudit({
      tenantId: req.user!.tenantId,
      actorType: "user",
      actorId: req.user!.id,
      actorLabel: req.user!.username,
      action: "user.create",
      targetType: "user",
      targetId: user.id,
      meta: { username: user.username },
    });
    res.status(201).json(user);
  },

  async update(req: Request, res: Response) {
    const input = userSchema.partial().parse(req.body);
    const user = await usersService.update(req.user!.tenantId, Number(req.params.id), input);
    if (input.roleId !== undefined) {
      recordAudit({
        tenantId: req.user!.tenantId,
        actorType: "user",
        actorId: req.user!.id,
        actorLabel: req.user!.username,
        action: "user.role_change",
        targetType: "user",
        targetId: user.id,
        meta: { username: user.username, roleId: input.roleId },
      });
    }
    res.json(user);
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    const user = await usersService.get(req.user!.tenantId, id);
    await usersService.remove(req.user!.tenantId, id);
    recordAudit({
      tenantId: req.user!.tenantId,
      actorType: "user",
      actorId: req.user!.id,
      actorLabel: req.user!.username,
      action: "user.delete",
      targetType: "user",
      targetId: id,
      meta: { username: user.username },
    });
    res.status(204).send();
  },
};
