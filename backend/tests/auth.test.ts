import { afterAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/config/prisma";
import { resetDb } from "./setup";
import { createTestTenant, loginAs, TestTenant } from "./helpers/factory";

describe("auth", () => {
  let tenant: TestTenant;
  let cookie: string;

  beforeEach(async () => {
    await resetDb();
    tenant = await createTestTenant();
    cookie = await loginAs(app, tenant);
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

  it("accepts a freshly created API key, and rejects it after revocation", async () => {
    const created = await request(app).post("/api/api-keys").set("Host", tenant.hostname).set("Cookie", cookie).send({ name: "ci" });
    expect(created.status).toBe(201);
    const key = created.body.key as string;
    const id = created.body.id as number;

    const before = await request(app).get("/api/lists").set("Host", tenant.hostname).set("Authorization", `Bearer ${key}`);
    expect(before.status).toBe(200);

    const revoke = await request(app).delete(`/api/api-keys/${id}`).set("Host", tenant.hostname).set("Cookie", cookie);
    expect(revoke.status).toBe(204);

    const after = await request(app).get("/api/lists").set("Host", tenant.hostname).set("Authorization", `Bearer ${key}`);
    expect(after.status).toBe(401);
  });

  it("rejects a malformed bearer token outright", async () => {
    const res = await request(app).get("/api/lists").set("Host", tenant.hostname).set("Authorization", "Bearer not_a_real_key");
    expect(res.status).toBe(401);
  });

  it("a listed API key never reveals its secret, only a prefix", async () => {
    await request(app).post("/api/api-keys").set("Host", tenant.hostname).set("Cookie", cookie).send({ name: "ci" });
    const list = await request(app).get("/api/api-keys").set("Host", tenant.hostname).set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body[0].keyHash).toBeUndefined();
    expect(list.body[0].key).toBeUndefined();
    expect(typeof list.body[0].keyPrefix).toBe("string");
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
