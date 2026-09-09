import { Request, Response } from "express";
import { z } from "zod";
import { recordAudit } from "../../common/audit/auditLog";
import { domainsService } from "./domains.service";

const domainSchema = z.object({
  domain: z.string().min(3),
  maxDailyCap: z.number().int().positive().optional(),
});

const warmupSchema = z.object({
  maxDailyCap: z.number().int().positive().optional(),
  restartWarmup: z.boolean().optional(),
});

export const domainsController = {
  async list(req: Request, res: Response) {
    res.json(await domainsService.list(req.user!.tenantId));
  },

  async get(req: Request, res: Response) {
    res.json(await domainsService.get(req.user!.tenantId, Number(req.params.id)));
  },

  async create(req: Request, res: Response) {
    const input = domainSchema.parse(req.body);
    const domain = await domainsService.create(req.user!.tenantId, input);
    recordAudit({
      tenantId: req.user!.tenantId,
      actorType: "user",
      actorId: req.user!.id,
      actorLabel: req.user!.username,
      action: "domain.add",
      targetType: "domain",
      targetId: domain.id,
      meta: { domain: domain.domain },
    });
    res.status(201).json(domain);
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    const domain = await domainsService.get(req.user!.tenantId, id);
    await domainsService.remove(req.user!.tenantId, id);
    recordAudit({
      tenantId: req.user!.tenantId,
      actorType: "user",
      actorId: req.user!.id,
      actorLabel: req.user!.username,
      action: "domain.remove",
      targetType: "domain",
      targetId: id,
      meta: { domain: domain.domain },
    });
    res.status(204).send();
  },

  async dnsRecords(req: Request, res: Response) {
    res.json(await domainsService.getDnsRecords(req.user!.tenantId, Number(req.params.id)));
  },

  async verify(req: Request, res: Response) {
    const id = Number(req.params.id);
    const result = await domainsService.verify(req.user!.tenantId, id);
    recordAudit({
      tenantId: req.user!.tenantId,
      actorType: "user",
      actorId: req.user!.id,
      actorLabel: req.user!.username,
      action: "domain.verify",
      targetType: "domain",
      targetId: id,
      meta: {
        domain: result.domain,
        spfStatus: result.spfStatus,
        dkimStatus: result.dkimStatus,
        dmarcStatus: result.dmarcStatus,
        mxStatus: result.mxStatus,
      },
    });
    res.json(result);
  },

  async setWarmup(req: Request, res: Response) {
    const input = warmupSchema.parse(req.body);
    res.json(await domainsService.setWarmup(req.user!.tenantId, Number(req.params.id), input));
  },
};
