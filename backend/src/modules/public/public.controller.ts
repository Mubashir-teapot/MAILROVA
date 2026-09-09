import { Request, Response } from "express";
import { z } from "zod";
import { publicService } from "./public.service";

const subscribeSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  listUuids: z.array(z.string().uuid()),
});

const unsubscribeSchema = z.object({ listUuid: z.string().uuid() });

const unsubscribeLinkSchema = z.object({ email: z.string().email(), token: z.string().min(1) });

export const publicController = {
  async lists(req: Request, res: Response) {
    res.json(await publicService.listPublicLists(req.tenantId!));
  },

  async subscribe(req: Request, res: Response) {
    const input = subscribeSchema.parse(req.body);
    await publicService.subscribe(req.tenantId!, input.email, input.name ?? "", input.listUuids);
    res.json({ data: true });
  },

  async confirmOptin(req: Request, res: Response) {
    res.json(await publicService.confirmOptin(req.tenantId!, req.params.subscriberUuid));
  },

  async unsubscribe(req: Request, res: Response) {
    const { listUuid } = unsubscribeSchema.parse(req.body);
    await publicService.unsubscribe(req.tenantId!, req.params.subscriberUuid, listUuid);
    res.json({ data: true });
  },

  async unsubscribeByLink(req: Request, res: Response) {
    const { email, token } = unsubscribeLinkSchema.parse(req.query);
    await publicService.unsubscribeByToken(req.tenantId!, email, token);
    res.json({ data: true });
  },
};
