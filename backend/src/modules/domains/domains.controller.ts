import { Request, Response } from "express";
import { z } from "zod";
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
    res.status(201).json(await domainsService.create(req.user!.tenantId, input));
  },

  async remove(req: Request, res: Response) {
    await domainsService.remove(req.user!.tenantId, Number(req.params.id));
    res.status(204).send();
  },

  async dnsRecords(req: Request, res: Response) {
    res.json(await domainsService.getDnsRecords(req.user!.tenantId, Number(req.params.id)));
  },

  async verify(req: Request, res: Response) {
    res.json(await domainsService.verify(req.user!.tenantId, Number(req.params.id)));
  },

  async setWarmup(req: Request, res: Response) {
    const input = warmupSchema.parse(req.body);
    res.json(await domainsService.setWarmup(req.user!.tenantId, Number(req.params.id), input));
  },
};
