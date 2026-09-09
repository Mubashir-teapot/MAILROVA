import { Request, Response } from "express";
import { z } from "zod";
import { isUnsafeEmailHtml } from "../../common/utils/sanitizeEmailHtml";
import { templatesService } from "./templates.service";

const templateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["campaign", "campaign_visual", "tx"]).optional(),
  subject: z.string().optional(),
  body: z.string().min(1).refine((html) => !isUnsafeEmailHtml(html), {
    message: "Content contains disallowed markup (script tags, event handlers, or javascript:/data: URLs)",
  }),
  bodySource: z.unknown().optional(),
  isDefault: z.boolean().optional(),
});

export const templatesController = {
  async list(req: Request, res: Response) {
    res.json(await templatesService.list(req.user!.tenantId));
  },

  async get(req: Request, res: Response) {
    res.json(await templatesService.get(req.user!.tenantId, Number(req.params.id)));
  },

  async create(req: Request, res: Response) {
    const input = templateSchema.parse(req.body);
    res.status(201).json(await templatesService.create(req.user!.tenantId, input));
  },

  async update(req: Request, res: Response) {
    const input = templateSchema.partial().parse(req.body);
    res.json(await templatesService.update(req.user!.tenantId, Number(req.params.id), input));
  },

  async remove(req: Request, res: Response) {
    await templatesService.remove(req.user!.tenantId, Number(req.params.id));
    res.status(204).send();
  },

  async preview(req: Request, res: Response) {
    const data = z.record(z.unknown()).parse(req.body);
    res.json(await templatesService.preview(req.user!.tenantId, Number(req.params.id), data));
  },

  async sendTest(req: Request, res: Response) {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    await templatesService.sendTest(req.user!.tenantId, Number(req.params.id), email);
    res.json({ data: true });
  },
};
