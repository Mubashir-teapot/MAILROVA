import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/config/prisma";
import { campaignsRepository } from "../src/modules/campaigns/campaigns.repository";
import { resetDb } from "./setup";
import { createTestTenant, TestTenant } from "./helpers/factory";

// Tests the data-layer invariants the pg-boss rewrite depends on directly
// (no live SMTP, no waiting on the async queue) — this is the actual bug
// that was fixed: a `failed` CampaignSend row used to be treated exactly
// like `sent`, permanently excluding that recipient from every future
// attempt. See campaigns.worker.ts / campaigns.repository.ts. End-to-end
// queue processing is covered by manually sending a real campaign (see the
// plan's verification section) rather than here.
describe("campaign dispatch — retry logic and dedup", () => {
  let tenant: TestTenant;
  let campaignId: number;
  let subscriberId: number;
  const email = "recipient@example.com";

  beforeEach(async () => {
    await resetDb();
    tenant = await createTestTenant();

    const list = await prisma.list.create({ data: { tenantId: tenant.tenant.id, name: "L", type: "private", optin: "single" } });
    const subscriber = await prisma.subscriber.create({
      data: { tenantId: tenant.tenant.id, email, name: "Recipient", status: "enabled" },
    });
    subscriberId = subscriber.id;
    await prisma.subscriberList.create({ data: { subscriberId: subscriber.id, listId: list.id, status: "confirmed" } });

    const campaign = await prisma.campaign.create({
      data: { tenantId: tenant.tenant.id, name: "C", subject: "S", fromEmail: "from@example.com", body: "<p>hi</p>", status: "running" },
    });
    campaignId = campaign.id;
    await prisma.campaignList.create({ data: { campaignId: campaign.id, listId: list.id, listName: list.name } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("a recipient stays eligible after a failed attempt, but not after a permanent one", async () => {
    let eligible = await campaignsRepository.findEligibleSubscribers(tenant.tenant.id, campaignId);
    expect(eligible.map((s) => s.email)).toContain(email);

    await campaignsRepository.recordSend(campaignId, email, "failed", { subscriberId, error: "SMTP timeout" });

    // The literal bug: this used to be excluded here too.
    eligible = await campaignsRepository.findEligibleSubscribers(tenant.tenant.id, campaignId);
    expect(eligible.map((s) => s.email)).toContain(email);

    const pendingWhileRetrying = await campaignsRepository.hasPendingRecipients(tenant.tenant.id, campaignId, []);
    expect(pendingWhileRetrying).toBe(true);

    await campaignsRepository.recordSend(campaignId, email, "undeliverable", { subscriberId, error: "retries exhausted" });

    eligible = await campaignsRepository.findEligibleSubscribers(tenant.tenant.id, campaignId);
    expect(eligible.map((s) => s.email)).not.toContain(email);

    const pendingAfterExhausted = await campaignsRepository.hasPendingRecipients(tenant.tenant.id, campaignId, []);
    expect(pendingAfterExhausted).toBe(false);
  });

  it("a successful send is also excluded from future eligibility", async () => {
    await campaignsRepository.recordSend(campaignId, email, "sent", { subscriberId });
    const eligible = await campaignsRepository.findEligibleSubscribers(tenant.tenant.id, campaignId);
    expect(eligible.map((s) => s.email)).not.toContain(email);
  });

  it("recordSend never creates a second row for the same (campaign, email) — upsert, not insert", async () => {
    await campaignsRepository.recordSend(campaignId, email, "failed", { subscriberId, error: "first attempt" });
    await campaignsRepository.recordSend(campaignId, email, "failed", { subscriberId, error: "second attempt" });
    await campaignsRepository.recordSend(campaignId, email, "sent", { subscriberId });

    const rows = await prisma.campaignSend.findMany({ where: { campaignId, email } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("sent");
  });

  it("a suppressed recipient is excluded from eligibility even with no prior CampaignSend row", async () => {
    await prisma.suppression.create({ data: { tenantId: tenant.tenant.id, email, reason: "bounce" } });
    const eligible = await campaignsRepository.findEligibleSubscribers(tenant.tenant.id, campaignId);
    expect(eligible.map((s) => s.email)).not.toContain(email);
  });
});
