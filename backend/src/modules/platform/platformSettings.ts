import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";

// Platform-wide runtime knobs, editable live from the platform admin UI —
// no container restart needed to change them (unlike a plain env var).
export const PLATFORM_SETTING_KEYS = {
  schedulerIntervalMs: "campaign_scheduler_interval_ms",
} as const;

export async function getSchedulerIntervalMs(): Promise<number> {
  const row = await prisma.platformSetting.findUnique({ where: { key: PLATFORM_SETTING_KEYS.schedulerIntervalMs } });
  const value = row ? Number(row.value) : NaN;
  return Number.isFinite(value) && value >= 1000 ? value : env.campaignSchedulerIntervalMs;
}

export function getAllPlatformSettings() {
  return prisma.platformSetting.findMany();
}

export function setPlatformSetting(key: string, value: unknown) {
  const jsonValue = value as Prisma.InputJsonValue;
  return prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: jsonValue },
    update: { value: jsonValue },
  });
}
