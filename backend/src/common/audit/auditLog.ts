import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export interface AuditEntry {
  tenantId?: number; // omitted for platform-level actions (tenant create/suspend)
  actorType: "user" | "platform_admin" | "api_key";
  actorId: number;
  actorLabel: string;
  action: string;
  targetType?: string;
  targetId?: number;
  meta?: Record<string, unknown>;
}

// Fire-and-forget by design — an audit-log write failing must never block
// the action it's recording. Logged to console on failure so it's still
// visible somewhere rather than silently vanishing.
export function recordAudit(entry: AuditEntry): void {
  prisma.auditLog
    .create({
      data: {
        tenantId: entry.tenantId,
        actorType: entry.actorType,
        actorId: entry.actorId,
        actorLabel: entry.actorLabel,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        meta: (entry.meta ?? {}) as Prisma.InputJsonValue,
      },
    })
    .catch((err) => console.error("failed to write audit log:", err));
}
