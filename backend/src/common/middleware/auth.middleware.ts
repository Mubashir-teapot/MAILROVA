import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { ApiError } from "../utils/ApiError";

export const SESSION_COOKIE = "mailrova_session";

export interface AuthUser {
  id: number;
  tenantId: number;
  username: string;
  permissions: string[];
  roleName: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Session lives in an HttpOnly cookie — never in localStorage, never read by
// client-side JS — so an XSS bug can't steal it and impersonate the user.
export function setSessionCookie(res: Response, user: AuthUser) {
  const token = jwt.sign(user, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.sessionCookieMaxAgeMs,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) throw ApiError.unauthorized("Not signed in");

    const user = jwt.verify(token, env.jwtSecret) as AuthUser;
    // Defense in depth: a session issued for one tenant must not be usable
    // on a request that resolved to a different tenant's hostname.
    if (req.tenantId !== undefined && user.tenantId !== req.tenantId) {
      throw new Error("tenant mismatch");
    }
    req.user = user;
    next();
  } catch (err) {
    next(err instanceof ApiError ? err : ApiError.unauthorized("Invalid or expired session"));
  }
}

// ponytail: single "has any of these permissions" check. A full per-list permission
// matrix (like the source app's list-roles) is not implemented — add if a role needs
// scoping to specific lists rather than all-or-nothing.
export function requirePermission(...perms: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();
    const ok = perms.some((p) => user.permissions.includes(p));
    if (!ok) throw ApiError.forbidden(`Missing permission: ${perms.join(" or ")}`);
    next();
  };
}

// Managing users and roles together is how someone with a lesser role could
// escalate themselves (grant their own role more permissions, or create a
// new account and assign it a stronger role) — deliberately not just
// another permission a custom role can be granted, only the literal
// "Super Admin" role (the one seed.ts/platform bootstrap always creates,
// and the only one roles.service.ts refuses to let anyone delete) passes.
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.roleName !== "Super Admin") throw ApiError.forbidden("Super Admin only");
  next();
}
