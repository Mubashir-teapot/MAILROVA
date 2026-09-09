import bcrypt from "bcryptjs";
import crypto from "crypto";
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

    // API users authenticate with a generated token instead of a password.
    const isApi = input.type === "api";
    const plainSecret = isApi ? crypto.randomBytes(32).toString("hex") : input.password;
    if (!plainSecret) throw ApiError.badRequest("Password is required");

    const passwordHash = await bcrypt.hash(plainSecret, 10);
    const user = await usersRepository.create({
      tenant: { connect: { id: tenantId } },
      username: input.username,
      email: input.email,
      passwordHash,
      type: isApi ? "api" : "user",
      role: input.roleId ? { connect: { id: input.roleId } } : undefined,
    });

    // The plaintext API token is only ever shown once, at creation.
    return isApi ? { ...user, apiToken: plainSecret } : user;
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
