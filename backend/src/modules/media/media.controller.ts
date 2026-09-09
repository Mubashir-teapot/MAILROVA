import { Request, Response } from "express";
import { ApiError } from "../../common/utils/ApiError";
import { mediaService } from "./media.service";

export const mediaController = {
  async list(req: Request, res: Response) {
    res.json(await mediaService.list(req.user!.tenantId));
  },

  async upload(req: Request, res: Response) {
    if (!req.file) throw ApiError.badRequest("No file uploaded");
    const media = await mediaService.upload(req.user!.tenantId, req.file.buffer, req.file.originalname, req.file.mimetype);
    res.status(201).json(media);
  },

  async remove(req: Request, res: Response) {
    await mediaService.remove(req.user!.tenantId, Number(req.params.id));
    res.status(204).send();
  },
};
