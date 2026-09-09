import { Request, Response } from "express";
import { z } from "zod";
import { recordAudit } from "../../common/audit/auditLog";
import { mailboxesRepository } from "./mailboxes.repository";
import { mailboxesService } from "./mailboxes.service";

const createSchema = z.object({
  domainId: z.number().int(),
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8).optional(),
  dailyCap: z.number().int().positive().optional(),
});

export const mailboxesController = {
  async list(req: Request, res: Response) {
    res.json(await mailboxesService.list(req.user!.tenantId));
  },

  async mine(req: Request, res: Response) {
    res.json(await mailboxesService.mine(req.user!.tenantId, req.user!.id));
  },

  async create(req: Request, res: Response) {
    const input = createSchema.parse(req.body);
    const mailbox = await mailboxesService.create(req.user!.tenantId, input);
    recordAudit({
      tenantId: req.user!.tenantId,
      actorType: "user",
      actorId: req.user!.id,
      actorLabel: req.user!.username,
      action: "mailbox.create",
      targetType: "mailbox",
      targetId: mailbox.id,
      meta: { email: mailbox.email },
    });
    res.status(201).json(mailbox);
  },

  async setPassword(req: Request, res: Response) {
    const { password } = z.object({ password: z.string().min(8) }).parse(req.body);
    res.json(await mailboxesService.setPassword(req.user!.tenantId, Number(req.params.id), password));
  },

  async setEnabled(req: Request, res: Response) {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    res.json(await mailboxesService.setEnabled(req.user!.tenantId, Number(req.params.id), enabled));
  },

  async setDailyCap(req: Request, res: Response) {
    const { dailyCap } = z.object({ dailyCap: z.number().int().positive() }).parse(req.body);
    res.json(await mailboxesService.setDailyCap(req.user!.tenantId, Number(req.params.id), dailyCap));
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    const mailbox = await mailboxesRepository.findById(req.user!.tenantId, id);
    await mailboxesService.remove(req.user!.tenantId, id);
    recordAudit({
      tenantId: req.user!.tenantId,
      actorType: "user",
      actorId: req.user!.id,
      actorLabel: req.user!.username,
      action: "mailbox.delete",
      targetType: "mailbox",
      targetId: id,
      meta: { email: mailbox?.email },
    });
    res.status(204).send();
  },

  async assignUsers(req: Request, res: Response) {
    const { userIds } = z.object({ userIds: z.array(z.number().int()) }).parse(req.body);
    await mailboxesService.assignUsers(req.user!.tenantId, Number(req.params.id), userIds);
    res.status(204).send();
  },
};
