import { Request, Response } from "express";
import { z } from "zod";
import { recordAudit } from "../../common/audit/auditLog";
import { isUnsafeEmailHtml } from "../../common/utils/sanitizeEmailHtml";
import { campaignsService } from "./campaigns.service";

const campaignSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  fromEmail: z.string().email(),
  body: z.string().min(1).refine((html) => !isUnsafeEmailHtml(html), {
    message: "Content contains disallowed markup (script tags, event handlers, or javascript:/data: URLs)",
  }),
  altbody: z.string().optional(),
  contentType: z.enum(["richtext", "html", "markdown", "plain", "visual"]).optional(),
  templateId: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  sendAt: z.string().datetime().optional(),
  listIds: z.array(z.number().int()).default([]),
  toEmails: z.array(z.string().email()).optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
});

const statusSchema = z.object({
  status: z.enum(["draft", "scheduled", "running", "paused", "finished", "cancelled"]),
});

export const campaignsController = {
  async list(req: Request, res: Response) {
    res.json(await campaignsService.list(req.user!.tenantId));
  },

  async get(req: Request, res: Response) {
    res.json(await campaignsService.get(req.user!.tenantId, Number(req.params.id)));
  },

  async deliveryLog(req: Request, res: Response) {
    res.json(await campaignsService.deliveryLog(req.user!.tenantId, Number(req.params.id)));
  },

  async create(req: Request, res: Response) {
    const input = campaignSchema.parse(req.body);
    res.status(201).json(await campaignsService.create(req.user!.tenantId, input));
  },

  async update(req: Request, res: Response) {
    const input = campaignSchema.partial().parse(req.body);
    res.json(await campaignsService.update(req.user!.tenantId, Number(req.params.id), input));
  },

  async remove(req: Request, res: Response) {
    await campaignsService.remove(req.user!.tenantId, Number(req.params.id));
    res.status(204).send();
  },

  async setStatus(req: Request, res: Response) {
    const { status } = statusSchema.parse(req.body);
    const id = Number(req.params.id);
    const campaign = await campaignsService.setStatus(req.user!.tenantId, id, status);
    if (status === "running" || status === "cancelled") {
      recordAudit({
        tenantId: req.user!.tenantId,
        actorType: "user",
        actorId: req.user!.id,
        actorLabel: req.user!.username,
        action: status === "running" ? "campaign.send" : "campaign.cancel",
        targetType: "campaign",
        targetId: id,
        meta: { name: campaign.name },
      });
    }
    res.json(campaign);
  },

  async preflight(req: Request, res: Response) {
    res.json(await campaignsService.preflight(req.user!.tenantId, Number(req.params.id)));
  },
};
