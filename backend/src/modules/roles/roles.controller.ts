import { Request, Response } from "express";
import { z } from "zod";
import { recordAudit } from "../../common/audit/auditLog";
import { ALL_PERMISSIONS } from "../../common/permissions";
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

  async permissions(_req: Request, res: Response) {
    res.json(ALL_PERMISSIONS);
  },

  async create(req: Request, res: Response) {
    const input = roleSchema.parse(req.body);
    res.status(201).json(await rolesService.create(req.user!.tenantId, input));
  },

  async update(req: Request, res: Response) {
    const input = roleSchema.partial().parse(req.body);
    const role = await rolesService.update(req.user!.tenantId, Number(req.params.id), input);
    if (input.permissions !== undefined) {
      recordAudit({
        tenantId: req.user!.tenantId,
        actorType: "user",
        actorId: req.user!.id,
        actorLabel: req.user!.username,
        action: "role.permissions_change",
        targetType: "role",
        targetId: role.id,
        meta: { name: role.name, permissions: input.permissions },
      });
    }
    res.json(role);
  },

  async remove(req: Request, res: Response) {
    await rolesService.remove(req.user!.tenantId, Number(req.params.id));
    res.status(204).send();
  },
};
