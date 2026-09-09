import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../../common/utils/ApiError";
import { importService } from "./import.service";

const paramsSchema = z.object({
  mode: z.enum(["subscribe", "blocklist"]).default("subscribe"),
  listIds: z.array(z.number().int()).default([]),
  templateId: z.number().int().optional(),
});

export const importController = {
  async importSubscribers(req: Request, res: Response) {
    if (!req.file) throw ApiError.badRequest("No CSV file uploaded");
    const params = paramsSchema.parse(JSON.parse(req.body.params ?? "{}"));
    const result = await importService.importCsv(req.user!.tenantId, req.file.buffer.toString("utf-8"), params);
    res.json(result);
  },
};
