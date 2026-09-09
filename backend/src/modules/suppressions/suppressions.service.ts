import { ApiError } from "../../common/utils/ApiError";
import { suppressionsRepository } from "./suppressions.repository";

export const suppressionsService = {
  list(tenantId: number) {
    return suppressionsRepository.findAll(tenantId);
  },

  add(tenantId: number, email: string) {
    return suppressionsRepository.upsert(tenantId, email.toLowerCase().trim(), "manual");
  },

  async remove(tenantId: number, id: number) {
    const row = await suppressionsRepository.findById(tenantId, id);
    if (!row) throw ApiError.notFound("Suppression entry not found");
    await suppressionsRepository.remove(tenantId, id);
  },
};
