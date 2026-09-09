import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/config/prisma";
import { makeUnsubscribeToken } from "../src/common/utils/unsubscribeToken";
import { resetDb } from "./setup";
import { createTestTenant, loginAs, TestTenant } from "./helpers/factory";

describe("suppression", () => {
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

  const authed = (method: "get" | "post" | "put" | "delete", path: string) =>
    request(app)[method](path).set("Host", tenant.hostname).set("Cookie", cookie);

  it("a hard bounce suppresses the address, and a tx send to it is then rejected", async () => {
    const sub = await authed("post", "/api/subscribers").send({ email: "bouncy@example.com", name: "Bouncy" });
    expect(sub.status).toBe(201);

    const bounce = await authed("post", "/api/bounces").send({ email: "bouncy@example.com", type: "hard", source: "test" });
    expect(bounce.status).toBe(201);

    const suppressions = await authed("get", "/api/suppressions");
    expect(suppressions.body.some((s: { email: string }) => s.email === "bouncy@example.com")).toBe(true);

    const template = await authed("post", "/api/templates").send({ name: "Welcome", type: "tx", subject: "Hi", body: "<p>hi</p>" });
    expect(template.status).toBe(201);

    const send = await authed("post", "/api/tx").send({ templateId: template.body.id, subscriberEmail: "bouncy@example.com" });
    expect(send.status).toBe(400);
  });

  it("unsubscribing via the tokenized link adds the address to the suppression list", async () => {
    const email = "optout@example.com";
    const token = makeUnsubscribeToken(tenant.tenant.id, email);

    const res = await request(app)
      .get(`/api/public/unsubscribe-link?email=${encodeURIComponent(email)}&token=${token}`)
      .set("Host", tenant.hostname);
    expect(res.status).toBe(200);

    const suppressions = await authed("get", "/api/suppressions");
    expect(suppressions.body.some((s: { email: string; reason: string }) => s.email === email && s.reason === "unsubscribe")).toBe(true);
  });

  it("an invalid unsubscribe token is rejected and does not suppress anything", async () => {
    const res = await request(app)
      .get(`/api/public/unsubscribe-link?email=${encodeURIComponent("nope@example.com")}&token=not-a-real-token`)
      .set("Host", tenant.hostname);
    expect(res.status).toBe(401);

    const suppressions = await authed("get", "/api/suppressions");
    expect(suppressions.body.some((s: { email: string }) => s.email === "nope@example.com")).toBe(false);
  });

  it("CSV import skips a suppressed address instead of re-subscribing it", async () => {
    await authed("post", "/api/suppressions").send({ email: "gone@example.com" });
    const list = await authed("post", "/api/lists").send({ name: "Import target" });

    const csv = "email,name\ngone@example.com,Gone\nfresh@example.com,Fresh\n";
    const res = await request(app)
      .post("/api/import/subscribers")
      .set("Host", tenant.hostname)
      .set("Cookie", cookie)
      .field("params", JSON.stringify({ mode: "subscribe", listIds: [list.body.id] }))
      .attach("file", Buffer.from(csv), "subscribers.csv");

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);
    expect(res.body.skipped).toBe(1);

    const subscribers = await authed("get", "/api/subscribers");
    expect(subscribers.body.results.some((s: { email: string }) => s.email === "gone@example.com")).toBe(false);
    expect(subscribers.body.results.some((s: { email: string }) => s.email === "fresh@example.com")).toBe(true);
  });
});
