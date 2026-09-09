import crypto from "crypto";
import { env } from "../../config/env";

// A short HMAC over (tenantId, email) — lets the public unsubscribe link
// work with no login, while still making it impossible to unsubscribe an
// address you don't already have a valid link for (i.e. one that was
// actually mailed to that address).
export function makeUnsubscribeToken(tenantId: number, email: string): string {
  return crypto
    .createHmac("sha256", env.jwtSecret)
    .update(`${tenantId}:${email.toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(tenantId: number, email: string, token: string): boolean {
  const expected = makeUnsubscribeToken(tenantId, email);
  const a = Buffer.from(expected);
  const b = Buffer.from(token || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
