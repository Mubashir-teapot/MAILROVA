import { BounceType, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../common/utils/ApiError";
import { bouncesRepository } from "./bounces.repository";

type BounceAction = "none" | "blocklist" | "unsubscribe" | "delete";
type BounceActions = Record<BounceType, { count: number; action: BounceAction }>;

const DEFAULT_ACTIONS: BounceActions = {
  soft: { count: 2, action: "none" },
  hard: { count: 1, action: "blocklist" },
  complaint: { count: 1, action: "blocklist" },
};

async function getActions(tenantId: number): Promise<BounceActions> {
  const row = await prisma.setting.findUnique({ where: { tenantId_key: { tenantId, key: "bounce.actions" } } });
  return row ? { ...DEFAULT_ACTIONS, ...(row.value as unknown as Partial<BounceActions>) } : DEFAULT_ACTIONS;
}

export interface BounceInput {
  // Explicit tenant context for authenticated calls (e.g. POST /api/bounces).
  // Webhook calls (no auth) omit this and rely on subscriberUuid/campaignUuid
  // to resolve the tenant instead — see resolveTenantId() below.
  tenantId?: number;
  email?: string;
  subscriberUuid?: string;
  campaignId?: number;
  campaignUuid?: string;
  type: BounceType;
  source: string;
  meta?: Record<string, unknown>;
}

// A bounce webhook carries no login/session, so the tenant has to be derived
// from something in the payload. subscriberUuid and campaignUuid are both
// globally unique (unlike email, which is only unique per tenant), so either
// one unambiguously identifies the tenant. A bare e-mail with neither is
// genuinely ambiguous in a multi-tenant setup — logged and skipped rather
// than guessed.
async function resolveTenantId(input: BounceInput): Promise<number | null> {
  if (input.tenantId) return input.tenantId;
  if (input.subscriberUuid) {
    const s = await prisma.subscriber.findUnique({ where: { uuid: input.subscriberUuid }, select: { tenantId: true } });
    if (s) return s.tenantId;
  }
  if (input.campaignUuid) {
    const c = await prisma.campaign.findUnique({ where: { uuid: input.campaignUuid }, select: { tenantId: true } });
    if (c) return c.tenantId;
  }
  return null;
}

export const bouncesService = {
  list(tenantId: number) {
    return bouncesRepository.findAll(tenantId);
  },

  getActions,

  setActions(tenantId: number, actions: Partial<BounceActions>) {
    const value = { ...DEFAULT_ACTIONS, ...actions } as Prisma.InputJsonValue;
    return prisma.setting.upsert({
      where: { tenantId_key: { tenantId, key: "bounce.actions" } },
      create: { tenantId, key: "bounce.actions", value },
      update: { value },
    });
  },

  async record(input: BounceInput) {
    const tenantId = await resolveTenantId(input);
    if (!tenantId) {
      console.warn(`bounce ignored — could not resolve tenant (source=${input.source}, email=${input.email ?? "?"})`);
      return null;
    }

    const subscriber = input.subscriberUuid
      ? await prisma.subscriber.findUnique({ where: { uuid: input.subscriberUuid } })
      : input.email
      ? await prisma.subscriber.findUnique({ where: { tenantId_email: { tenantId, email: input.email.toLowerCase() } } })
      : null;

    if (!subscriber) return null; // unknown recipient — silently ignored, same as the source app.
    if (subscriber.status === "blocklisted") return null; // already actioned.

    const campaignId =
      input.campaignId ??
      (input.campaignUuid
        ? (await prisma.campaign.findFirst({ where: { uuid: input.campaignUuid, tenantId }, select: { id: true } }))?.id
        : undefined);

    const bounce = await bouncesRepository.create({
      tenant: { connect: { id: tenantId } },
      subscriber: { connect: { id: subscriber.id } },
      campaign: campaignId ? { connect: { id: campaignId } } : undefined,
      type: input.type,
      source: input.source,
      meta: (input.meta ?? {}) as Prisma.InputJsonValue,
    });

    const actions = await getActions(tenantId);
    const count = await bouncesRepository.countByType(subscriber.id, input.type);
    const rule = actions[input.type] ?? DEFAULT_ACTIONS[input.type];

    if (count >= rule.count) {
      if (rule.action === "blocklist") {
        await prisma.subscriber.update({ where: { id: subscriber.id, tenantId }, data: { status: "blocklisted" } });
        await prisma.subscriberList.updateMany({ where: { subscriberId: subscriber.id }, data: { status: "unsubscribed" } });
        await addSuppression(tenantId, subscriber.email, "bounce");
      } else if (rule.action === "unsubscribe") {
        await prisma.subscriberList.updateMany({ where: { subscriberId: subscriber.id }, data: { status: "unsubscribed" } });
      } else if (rule.action === "delete") {
        await prisma.subscriber.delete({ where: { id: subscriber.id, tenantId } });
        await addSuppression(tenantId, subscriber.email, "bounce");
      }
    }

    return bounce;
  },

  async remove(tenantId: number, id: number) {
    await bouncesRepository.remove(tenantId, id).catch(() => {
      throw ApiError.notFound("Bounce not found");
    });
  },
};

function addSuppression(tenantId: number, email: string, reason: string) {
  return prisma.suppression.upsert({
    where: { tenantId_email: { tenantId, email: email.toLowerCase() } },
    create: { tenantId, email: email.toLowerCase(), reason },
    update: { reason },
  });
}
