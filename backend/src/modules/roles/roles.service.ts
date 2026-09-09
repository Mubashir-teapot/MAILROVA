import { ApiError } from "../../common/utils/ApiError";
import { rolesRepository } from "./roles.repository";

export interface RoleInput {
  name: string;
  type?: "user" | "list";
  permissions?: string[];
}

export const rolesService = {
  list(tenantId: number) {
    return rolesRepository.findAll(tenantId);
  },

  async get(tenantId: number, id: number) {
    const role = await rolesRepository.findById(tenantId, id);
    if (!role) throw ApiError.notFound("Role not found");
    return role;
  },

  create(tenantId: number, input: RoleInput) {
    return rolesRepository.create({
      tenant: { connect: { id: tenantId } },
      name: input.name,
      type: input.type ?? "user",
      permissions: input.permissions ?? [],
    });
  },

  async update(tenantId: number, id: number, input: Partial<RoleInput>) {
    await rolesService.get(tenantId, id);
    return rolesRepository.update(tenantId, id, input);
  },

  async remove(tenantId: number, id: number) {
    const role = await rolesService.get(tenantId, id);
    if (role.name === "Super Admin") throw ApiError.forbidden("Super Admin role cannot be deleted");
    await rolesRepository.remove(tenantId, id);
  },
};
