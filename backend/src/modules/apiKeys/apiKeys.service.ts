import crypto from "crypto";
import { ApiError } from "../../common/utils/ApiError";
import type { AuthUser } from "../../common/middleware/auth.middleware";
import { apiKeysRepository } from "./apiKeys.repository";

const KEY_PREFIX_LEN = 10;

function generateKey(): { fullKey: string; keyPrefix: string; keyHash: string } {
  const raw = crypto.randomBytes(24).toString("hex"); // 48 hex chars of entropy
  const fullKey = `mrv_${raw}`;
  const keyPrefix = raw.slice(0, KEY_PREFIX_LEN); // fast lookup + shown in the UI to identify the key later
  const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");
  return { fullKey, keyPrefix, keyHash };
}

export const apiKeysService = {
  list(tenantId: number) {
    return apiKeysRepository.findAll(tenantId);
  },

  // Returns the plaintext key ONCE. Only `keyHash`/`keyPrefix` are ever
  // persisted — there is no way to retrieve this value again after this
  // response, by design.
  async create(tenantId: number, userId: number, name: string) {
    const { fullKey, keyPrefix, keyHash } = generateKey();
    const record = await apiKeysRepository.create({ tenantId, userId, name, keyPrefix, keyHash });
    return { id: record.id, uuid: record.uuid, name: record.name, key: fullKey, createdAt: record.createdAt };
  },

  async revoke(tenantId: number, id: number) {
    const key = await apiKeysRepository.findById(tenantId, id);
    if (!key) throw ApiError.notFound("API key not found");
    await apiKeysRepository.revoke(tenantId, id);
  },

  // Authenticates a Bearer token, returning the same AuthUser shape the
  // cookie-session path produces (see requireAuth in auth.middleware.ts), or
  // null if the token is malformed/unknown/revoked/for a disabled user.
  async authenticate(tenantId: number, bearerToken: string): Promise<AuthUser | null> {
    if (!bearerToken.startsWith("mrv_")) return null;
    const raw = bearerToken.slice(4);
    const keyPrefix = raw.slice(0, KEY_PREFIX_LEN);

    const record = await apiKeysRepository.findActiveByPrefix(tenantId, keyPrefix);
    if (!record) return null;

    const presentedHash = crypto.createHash("sha256").update(bearerToken).digest();
    const storedHash = Buffer.from(record.keyHash, "hex");
    if (presentedHash.length !== storedHash.length || !crypto.timingSafeEqual(presentedHash, storedHash)) return null;

    if (record.user.status !== "enabled") return null;

    apiKeysRepository.touchLastUsed(record.id).catch(() => undefined); // best-effort, never blocks the request

    return {
      id: record.user.id,
      tenantId: record.user.tenantId,
      username: record.user.username,
      permissions: record.user.role?.permissions ?? [],
    };
  },
};
