import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.BACKEND_PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  sessionCookieMaxAgeMs: Number(process.env.SESSION_COOKIE_MAX_AGE_MS ?? 7 * 24 * 60 * 60 * 1000),
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  // Comma-separated list of frontend origins allowed to send cookies
  // cross-origin (needed since a cookie-based session requires an explicit
  // CORS origin allowlist, not "*").
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((o) => o.trim()),

  campaignSchedulerIntervalMs: Number(process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS ?? 30_000),
  // Global send-rate throttle (messages/minute) — on top of the per-domain
  // and per-mailbox daily caps, this smooths out bursts so a big list
  // doesn't hammer the mail server (or receivers' rate limiters) all at once.
  sendRatePerMinute: Number(process.env.SEND_RATE_PER_MINUTE ?? 60),

  // MAIL_MODE picks the sending path: "self_hosted" always sends through the
  // `mta` container (see docker-compose.yml) regardless of what SMTP_* is
  // set to; "third_party" uses SMTP_HOST/PORT/USER/PASS as given (SES,
  // SendGrid, MXroute, etc). Nothing else in the app changes either way.
  smtp: (() => {
    const mode = (process.env.MAIL_MODE ?? "self_hosted") as "self_hosted" | "third_party";
    if (mode === "self_hosted") {
      return {
        mode,
        host: "mta",
        port: 25,
        secure: false,
        // The mta container's STARTTLS cert is self-signed (it's an
        // internal Docker-network hop, not a publicly-trusted endpoint) —
        // without this, nodemailer's default cert verification rejects it
        // with "self-signed certificate" on every single send.
        tls: { rejectUnauthorized: false },
        user: undefined,
        pass: undefined,
        fromEmail: process.env.FROM_EMAIL ?? "noreply@mailrova.local",
      };
    }
    return {
      mode,
      host: required("SMTP_HOST"),
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      tls: undefined,
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
      fromEmail: process.env.FROM_EMAIL ?? "noreply@mailrova.local",
    };
  })(),

  media: {
    // "filesystem" (default, local disk) or "s3" (AWS S3, Cloudflare R2, or any
    // S3-compatible endpoint — set S3_ENDPOINT for R2/MinIO).
    provider: (process.env.MEDIA_PROVIDER ?? "filesystem") as "filesystem" | "s3",
    s3: {
      endpoint: process.env.S3_ENDPOINT || undefined, // e.g. https://<accountid>.r2.cloudflarestorage.com
      region: process.env.S3_REGION ?? "auto",
      bucket: process.env.S3_BUCKET ?? "",
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      publicUrl: process.env.S3_PUBLIC_URL ?? "", // public base URL to prefix stored filenames
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    },
  },

  bounce: {
    // Shared secret ESP webhooks must present to POST to /webhooks/bounce/*.
    webhookKey: process.env.BOUNCE_WEBHOOK_KEY || undefined,
    postmarkUser: process.env.BOUNCE_POSTMARK_USER || undefined,
    postmarkPass: process.env.BOUNCE_POSTMARK_PASS || undefined,
  },

  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${process.env.BACKEND_PORT ?? 4000}`,

  // Self-hosted mail server (see docker-compose.yml `mta` service).
  mta: {
    containerName: process.env.MTA_CONTAINER_NAME ?? "mailrova-mta",
    dkimKeysPath: process.env.MTA_DKIM_KEYS_PATH ?? "/mta-dkim-keys",
    dkimSelector: process.env.DKIM_SELECTOR ?? "mail",
    hostname: process.env.MTA_HOSTNAME || undefined, // e.g. mail.marketing.yourdomain.com
    serverIp: process.env.SERVER_PUBLIC_IP || undefined, // for the SPF record
    // Domain bounce DSNs come back to (VERP return-path, see
    // campaigns.worker.ts + mta/ config) — defaults to MTA_HOSTNAME since
    // that's already the domain this server accepts inbound mail for.
    bounceDomain: process.env.BOUNCE_DOMAIN || process.env.MTA_HOSTNAME || undefined,
  },
};
