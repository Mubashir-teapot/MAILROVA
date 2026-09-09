import { Request, Response } from "express";
import { z } from "zod";
import { subscribersService } from "./subscribers.service";

const subscriberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  status: z.enum(["enabled", "disabled", "blocklisted"]).optional(),
  attribs: z.record(z.unknown()).optional(),
  listIds: z.array(z.number().int()).optional(),
});

export const subscribersController = {
  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const perPage = Number(req.query.perPage ?? 20);
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    res.json(await subscribersService.list(req.user!.tenantId, page, perPage, search));
  },

  async get(req: Request, res: Response) {
    res.json(await subscribersService.get(req.user!.tenantId, Number(req.params.id)));
  },

  async create(req: Request, res: Response) {
    const input = subscriberSchema.parse(req.body);
    res.status(201).json(await subscribersService.create(req.user!.tenantId, input));
  },

  async update(req: Request, res: Response) {
    const input = subscriberSchema.partial().parse(req.body);
    res.json(await subscribersService.update(req.user!.tenantId, Number(req.params.id), input));
  },

  async remove(req: Request, res: Response) {
    await subscribersService.remove(req.user!.tenantId, Number(req.params.id));
    res.status(204).send();
  },

  async blocklist(req: Request, res: Response) {
    await subscribersService.blocklist(req.user!.tenantId, Number(req.params.id));
    res.status(204).send();
  },

  async unsubscribeFromList(req: Request, res: Response) {
    const { listId } = z.object({ listId: z.number().int() }).parse(req.body);
    await subscribersService.unsubscribeFromList(req.user!.tenantId, Number(req.params.id), listId);
    res.status(204).send();
  },
};
