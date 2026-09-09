import { Request, Response } from "express";
import { auditLogsRepository } from "./auditLogs.repository";

export const auditLogsController = {
  async list(req: Request, res: Response) {
    res.json(await auditLogsRepository.findAll(req.user!.tenantId));
  },
};
