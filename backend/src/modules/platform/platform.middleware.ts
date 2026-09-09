import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { ApiError } from "../../common/utils/ApiError";

export const PLATFORM_SESSION_COOKIE = "mailrova_platform_session";

export interface PlatformAuthPayload {
  id: number;
  username: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      platformAdmin?: PlatformAuthPayload;
    }
  }
}

// A distinct cookie/session from tenant users — a platform admin manages
// tenants themselves and isn't a member of any one tenant's user table.
export function setPlatformSessionCookie(res: Response, payload: PlatformAuthPayload) {
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: "12h" });
  res.cookie(PLATFORM_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60 * 1000,
  });
}

export function clearPlatformSessionCookie(res: Response) {
  res.clearCookie(PLATFORM_SESSION_COOKIE, { path: "/" });
}

export function requirePlatformAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[PLATFORM_SESSION_COOKIE];
  if (!token) throw ApiError.unauthorized("Not signed in");
  try {
    req.platformAdmin = jwt.verify(token, env.jwtSecret) as PlatformAuthPayload;
    next();
  } catch {
    throw ApiError.unauthorized("Invalid or expired session");
  }
}
