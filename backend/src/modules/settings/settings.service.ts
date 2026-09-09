import { Prisma } from "@prisma/client";
import { settingsRepository } from "./settings.repository";

export const settingsService = {
  async getAll(tenantId: number) {
    const rows = await settingsRepository.findAll(tenantId);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },

  async setMany(tenantId: number, entries: Record<string, unknown>) {
    for (const [key, value] of Object.entries(entries)) {
      await settingsRepository.upsert(tenantId, key, value as Prisma.InputJsonValue);
    }
    return settingsService.getAll(tenantId);
  },
};
