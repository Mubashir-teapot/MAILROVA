import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "path";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { apiRouter } from "./routes";
import { platformRouter } from "./modules/platform/platform.routes";
import { bounceWebhooksRoutes } from "./modules/bounces/bounces.webhooks.routes";
import { resolveTenant } from "./common/middleware/tenant.middleware";
import { errorMiddleware, notFoundMiddleware } from "./common/middleware/error.middleware";
import { apiRateLimit, publicRateLimit } from "./common/middleware/rateLimit";

export const app = express();

// Baseline security headers. CSP is left to Next.js on the frontend side —
// this API never serves HTML, so a content-security-policy here would only
// add noise; helmet's other defaults (X-Content-Type-Options, no X-Powered-By,
// etc.) still apply.
app.use(helmet({ contentSecurityPolicy: false }));

// A cookie-based session requires an explicit origin allowlist — "*" is
// rejected by browsers once `credentials: true` is set.
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(cookieParser());

// Mounted before express.json() — the SES webhook needs the raw text/plain body.
app.use("/webhooks/bounce", publicRateLimit, bounceWebhooksRoutes);

app.use(express.json());
app.use("/uploads", express.static(path.resolve(env.uploadDir)));

// Liveness — process is up, nothing more. Never fails on its own.
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Readiness — can this instance actually serve traffic right now. Checked
// by an orchestrator/load balancer before routing to it, distinct from
// liveness: a healthy-but-not-ready instance (DB unreachable) should be
// taken out of rotation, not restarted.
app.get("/api/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready" });
  } catch (err) {
    res.status(503).json({ status: "not ready", error: err instanceof Error ? err.message : String(err) });
  }
});

// Platform-admin routes manage tenants themselves and are deliberately NOT
// tenant-scoped (a platform admin isn't a member of any one tenant).
app.use("/api/platform", platformRouter);

// Every other /api route belongs to whichever tenant owns the request's
// hostname — resolved once here, then relied on by requireAuth and every
// tenant-scoped repository. apiRateLimit is a baseline DoS guard; /auth/login
// and /public/* layer their own tighter limiters on top (see their routes).
app.use("/api", resolveTenant, apiRateLimit, apiRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
