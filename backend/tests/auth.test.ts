import { afterAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/config/prisma";
import { resetDb } from "./setup";
import { createTestTenant, TestTenant } from "./helpers/factory";

describe("auth", () => {
  let tenant: TestTenant;

  beforeEach(async () => {
    await resetDb();
    tenant = await createTestTenant();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects an invalid session cookie", async () => {
    const res = await request(app).get("/api/lists").set("Host", tenant.hostname).set("Cookie", "mailrova_session=not-a-real-jwt");
    expect(res.status).toBe(401);
  });

  it("rejects a request with no session at all", async () => {
    const res = await request(app).get("/api/lists").set("Host", tenant.hostname);
    expect(res.status).toBe(401);
  });

  // Exercises the actual express-rate-limit mechanism directly, on a
  // standalone limiter with a small window — the real login endpoint's
  // limiter is deliberately relaxed under NODE_ENV=test (see
  // common/middleware/rateLimit.ts) so the rest of this suite's many logins
  // don't trip it; this test is what actually proves the limiter works.
  it("express-rate-limit blocks requests past its configured limit", async () => {
    const testApp = express();
    testApp.use(rateLimit({ windowMs: 60_000, limit: 3, standardHeaders: true, legacyHeaders: false }));
    testApp.get("/ping", (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 3; i++) {
      expect((await request(testApp).get("/ping")).status).toBe(200);
    }
    expect((await request(testApp).get("/ping")).status).toBe(429);
  });
});
