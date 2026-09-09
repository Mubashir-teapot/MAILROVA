import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../../common/utils/ApiError";
import { clearSessionCookie, setSessionCookie } from "../../common/middleware/auth.middleware";
import { authService } from "./auth.service";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const authController = {
  async login(req: Request, res: Response) {
    if (!req.tenantId) throw ApiError.notFound("Unknown tenant");
    const { username, password } = loginSchema.parse(req.body);
    const user = await authService.login(req.tenantId, username, password);
    setSessionCookie(res, user);
    res.json({ id: user.id, username: user.username, permissions: user.permissions });
  },

  async logout(_req: Request, res: Response) {
    clearSessionCookie(res);
    res.status(204).send();
  },

  async me(req: Request, res: Response) {
    const result = await authService.me(req.user!.tenantId, req.user!.id);
    res.json(result);
  },
};
