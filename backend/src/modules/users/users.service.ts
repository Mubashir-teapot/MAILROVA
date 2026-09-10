import bcrypt from "bcryptjs";
import { ApiError } from "../../common/utils/ApiError";
import { usersRepository } from "./users.repository";

export interface UserInput {
  username: string;
  email: string;
  password?: string;
  type?: "user" | "api";
  roleId?: number;
}

export const usersService = {
  list(tenantId: number) {
    return usersRepository.findAll(tenantId);
  },

  async get(tenantId: number, id: number) {
    const user = await usersRepository.findById(tenantId, id);
    if (!user) throw ApiError.notFound("User not found");
    return user;
  },

  async create(tenantId: number, input: UserInput) {
    const existing = await usersRepository.findByUsernameOrEmail(tenantId, input.username, input.email);
    if (existing) throw ApiError.conflict("Username or email already in use");

    // A "user" logs in with a password. An "api" (service account) user type
    // also exists but has no working auth path now that API keys are gone
    // (ponytail: dead code path, kept only because dropping the "type"
    // column/enum value needs a migration; add a real auth mechanism for it
    // or remove the type entirely if a service-account concept is needed).
    const isApi = input.type === "api";
    if (!isApi && !input.password) throw ApiError.badRequest("Password is required");

    const passwordHash = isApi ? null : await bcrypt.hash(input.password!, 10);
    return usersRepository.create({
      tenant: { connect: { id: tenantId } },
      username: input.username,
      email: input.email,
      passwordHash,
      type: isApi ? "api" : "user",
      role: input.roleId ? { connect: { id: input.roleId } } : undefined,
    });
  },

  async update(tenantId: number, id: number, input: Partial<UserInput>) {
    await usersService.get(tenantId, id);
    const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined;
    return usersRepository.update(tenantId, id, {
      username: input.username,
      email: input.email,
      passwordHash,
      role: input.roleId ? { connect: { id: input.roleId } } : undefined,
    });
  },

  async remove(tenantId: number, id: number) {
    await usersService.get(tenantId, id);
    await usersRepository.remove(tenantId, id);
  },
};
