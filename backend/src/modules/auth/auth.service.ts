import bcrypt from "bcryptjs";
import { ApiError } from "../../common/utils/ApiError";
import { AuthUser } from "../../common/middleware/auth.middleware";
import { authRepository } from "./auth.repository";

export const authService = {
  async login(tenantId: number, username: string, password: string): Promise<AuthUser> {
    const user = await authRepository.findByUsername(tenantId, username);
    if (!user || !user.passwordHash || user.status !== "enabled") {
      throw ApiError.unauthorized("Invalid credentials");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw ApiError.unauthorized("Invalid credentials");

    return {
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      permissions: user.role?.permissions ?? [],
      roleName: user.role?.name ?? null,
    };
  },

  async me(tenantId: number, userId: number) {
    const user = await authRepository.findById(tenantId, userId);
    if (!user) throw ApiError.notFound("User not found");
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      permissions: user.role?.permissions ?? [],
      roleName: user.role?.name ?? null,
    };
  },
};
