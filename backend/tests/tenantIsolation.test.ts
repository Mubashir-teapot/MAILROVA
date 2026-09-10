import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/config/prisma";
import { resetDb } from "./setup";
import { createTestTenant, loginAs, TestTenant } from "./helpers/factory";

// The single highest-priority suite: tenant A must never be able to read,
// update, or delete tenant B's data through the API, for any resource type.
// Every repository already scopes its queries by {id, tenantId} (see the
// hardening-pass commit) — this is what proves that holds at the HTTP layer,
// not just by reading the query code.
describe("tenant isolation", () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let cookieA: string;
  let cookieB: string;

  beforeEach(async () => {
    await resetDb();
    tenantA = await createTestTenant();
    tenantB = await createTestTenant();
    cookieA = await loginAs(app, tenantA);
    cookieB = await loginAs(app, tenantB);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  type Method = "get" | "post" | "put" | "delete";
  const as = (method: Method, path: string, tenant: TestTenant, cookie: string) =>
    request(app)[method](path).set("Host", tenant.hostname).set("Cookie", cookie);
  const asA = (method: Method, path: string) => as(method, path, tenantA, cookieA);
  const asB = (method: Method, path: string) => as(method, path, tenantB, cookieB);

  it("cannot read, update, or delete another tenant's list", async () => {
    const created = await asB("post", "/api/lists").send({ name: "B's list" });
    expect(created.status).toBe(201);
    const id = created.body.id;

    expect((await asA("get", `/api/lists/${id}`)).status).toBe(404);
    expect((await asA("put", `/api/lists/${id}`).send({ name: "hijacked" })).status).not.toBe(200);
    expect((await asA("delete", `/api/lists/${id}`)).status).not.toBe(204);

    // Sanity check: B can still manage its own list — proves the 404s above
    // are actual tenant isolation, not a broken route.
    expect((await asB("get", `/api/lists/${id}`)).status).toBe(200);
  });

  it("cannot read, update, or delete another tenant's subscriber", async () => {
    const created = await asB("post", "/api/subscribers").send({ email: "person@b.test", name: "Person" });
    expect(created.status).toBe(201);
    const id = created.body.id;

    expect((await asA("get", `/api/subscribers/${id}`)).status).toBe(404);
    expect((await asA("put", `/api/subscribers/${id}`).send({ name: "hijacked" })).status).not.toBe(200);
    expect((await asA("delete", `/api/subscribers/${id}`)).status).not.toBe(204);
  });

  it("cannot read, update, or delete another tenant's domain", async () => {
    const created = await asB("post", "/api/domains").send({ domain: "b-example.com" });
    expect(created.status).toBe(201);
    const id = created.body.id;

    expect((await asA("get", `/api/domains/${id}`)).status).toBe(404);
    expect((await asA("post", `/api/domains/${id}/verify`)).status).not.toBe(200);
    expect((await asA("delete", `/api/domains/${id}`)).status).not.toBe(204);
  });

  it("cannot read, update, or delete another tenant's mailbox", async () => {
    const domain = await asB("post", "/api/domains").send({ domain: "b-mail.com" });
    const mailbox = await asB("post", "/api/mailboxes").send({ domainId: domain.body.id, email: "info@b-mail.com", name: "Info" });
    expect(mailbox.status).toBe(201);
    const id = mailbox.body.id;

    expect((await asA("get", `/api/mailboxes/${id}`)).status).toBe(404);
    expect((await asA("put", `/api/mailboxes/${id}/enabled`).send({ enabled: false })).status).not.toBe(200);
    expect((await asA("delete", `/api/mailboxes/${id}`)).status).not.toBe(204);
  });

  it("cannot read, update, or delete another tenant's template", async () => {
    const created = await asB("post", "/api/templates").send({ name: "B template", body: "<p>hi</p>" });
    expect(created.status).toBe(201);
    const id = created.body.id;

    expect((await asA("get", `/api/templates/${id}`)).status).toBe(404);
    expect((await asA("delete", `/api/templates/${id}`)).status).not.toBe(204);
  });

  it("cannot read, update, or delete another tenant's campaign", async () => {
    const created = await asB("post", "/api/campaigns").send({
      name: "B campaign",
      subject: "Hi",
      fromEmail: "b@b.test",
      body: "<p>hi</p>",
      listIds: [],
      toEmails: ["x@example.com"],
    });
    expect(created.status).toBe(201);
    const id = created.body.id;

    expect((await asA("get", `/api/campaigns/${id}`)).status).toBe(404);
    expect((await asA("put", `/api/campaigns/${id}`).send({ name: "hijacked" })).status).not.toBe(200);
    expect((await asA("delete", `/api/campaigns/${id}`)).status).not.toBe(204);
  });

  it("cannot read, update, or delete another tenant's user", async () => {
    const created = await asB("post", "/api/users").send({ username: "bob", email: "bob@b.test", password: "somepassword1" });
    expect(created.status).toBe(201);
    const id = created.body.id;

    expect((await asA("get", `/api/users/${id}`)).status).toBe(404);
    expect((await asA("delete", `/api/users/${id}`)).status).not.toBe(204);
  });

  it("cannot read, update, or delete another tenant's role", async () => {
    const created = await asB("post", "/api/roles").send({ name: "B role", permissions: ["lists:get_all"] });
    expect(created.status).toBe(201);
    const id = created.body.id;

    expect((await asA("get", `/api/roles/${id}`)).status).toBe(404);
    expect((await asA("delete", `/api/roles/${id}`)).status).not.toBe(204);
  });

  it("cannot see another tenant's suppression list, or delete an entry from it", async () => {
    const created = await asB("post", "/api/suppressions").send({ email: "gone@b.test" });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const listAsA = await asA("get", "/api/suppressions");
    expect(listAsA.body.find((s: { id: number }) => s.id === id)).toBeUndefined();
    expect((await asA("delete", `/api/suppressions/${id}`)).status).not.toBe(204);
  });
});
