import { NextFunction, Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { ApiError } from "../utils/ApiError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: number;
    }
  }
}

// Resolves which tenant owns the incoming request by matching the Host
// header against TenantHostname — this is what lets the same deployment
// serve multiple organizations on different domains (mail.company-a.com,
// mail.company-b.com, ...) without hardcoding one frontend domain.
//
// In local dev (no hostnames registered yet), falls back to the single
// tenant if exactly one exists — avoids needing a real DNS setup just to
// develop locally.
export async function resolveTenant(req: Request, _res: Response, next: NextFunction) {
  const host = (req.hostname || req.headers.host || "").toLowerCase().split(":")[0];

  const hostnameRow = await prisma.tenantHostname.findUnique({ where: { hostname: host } });
  if (hostnameRow) {
    req.tenantId = hostnameRow.tenantId;
    return next();
  }

  const tenants = await prisma.tenant.findMany({ select: { id: true }, take: 2 });
  if (tenants.length === 1) {
    req.tenantId = tenants[0].id;
    return next();
  }

  throw ApiError.notFound(`No tenant is configured for host "${host}"`);
}

export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  if (!req.tenantId) throw ApiError.notFound("Unknown tenant");
  next();
}
