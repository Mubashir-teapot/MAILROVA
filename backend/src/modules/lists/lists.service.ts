import { ApiError } from "../../common/utils/ApiError";
import { listsRepository } from "./lists.repository";

export interface ListInput {
  name: string;
  type?: "public" | "private";
  optin?: "single" | "double";
  status?: "active" | "archived";
  tags?: string[];
  description?: string;
}

export const listsService = {
  list(tenantId: number) {
    return listsRepository.findAll(tenantId);
  },

  async get(tenantId: number, id: number) {
    const list = await listsRepository.findById(tenantId, id);
    if (!list) throw ApiError.notFound("List not found");
    return list;
  },

  create(tenantId: number, input: ListInput) {
    return listsRepository.create({
      tenant: { connect: { id: tenantId } },
      name: input.name,
      type: input.type ?? "private",
      optin: input.optin ?? "single",
      status: input.status ?? "active",
      tags: input.tags ?? [],
      description: input.description,
    });
  },

  async update(tenantId: number, id: number, input: Partial<ListInput>) {
    await listsService.get(tenantId, id);
    return listsRepository.update(tenantId, id, input);
  },

  async remove(tenantId: number, id: number) {
    await listsService.get(tenantId, id);
    await listsRepository.remove(tenantId, id);
  },
};
