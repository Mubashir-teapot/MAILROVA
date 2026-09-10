import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { ApiError } from "../utils/ApiError";
import { authRepository } from "../../modules/auth/auth.repository";

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

    const decoded = jwt.verify(token, env.jwtSecret) as AuthUser;
    // Defense in depth: a session issued for one tenant must not be usable
    // on a request that resolved to a different tenant's hostname.
    if (req.tenantId !== undefined && decoded.tenantId !== req.tenantId) {
      throw new Error("tenant mismatch");
    }

    // Permissions/roleName are looked up fresh here, never trusted from the
    // token — otherwise a role edit (or a cookie signed before a field like
    // roleName existed) keeps acting on stale data for up to 7 days, and a
    // check like requireSuperAdmin can reject a token that requireAuth
    // itself accepted, which looks like a random 403 instead of a clean
    // "please log in again". A deleted user/role now turns into a real 401,
    // which the frontend already redirects to login on.
    const dbUser = await authRepository.findById(decoded.tenantId, decoded.id);
    if (!dbUser) throw new Error("user no longer exists");

    req.user = {
      id: dbUser.id,
      tenantId: dbUser.tenantId,
      username: dbUser.username,
      permissions: dbUser.role?.permissions ?? [],
      roleName: dbUser.role?.name ?? null,
    };
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
