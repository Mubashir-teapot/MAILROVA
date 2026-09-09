import { Domain } from "@prisma/client";
import { ApiError } from "../../common/utils/ApiError";
import { readDkimPublicKeyRecord, syncMtaDomains } from "../../common/docker/dockerService";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { domainsRepository } from "./domains.repository";
import { verifyDomainDns, verifyPtr } from "./dnsVerify";
import {
  BOUNCE_RATE_HOLD_THRESHOLD,
  COMPLAINT_RATE_HOLD_THRESHOLD,
  MIN_VOLUME_FOR_RATE_CHECK,
  RAMP_SCHEDULE,
  todaysCap,
  todayUtc,
} from "./warmup";

// Holds the warmup ramp at its current step (instead of advancing) if
// yesterday's bounce/complaint rate for this domain crossed the threshold —
// standard practice: a fresh IP/domain that starts bouncing needs volume
// capped where it is, not pushed higher. Implemented by nudging
// `warmupStartedAt` forward by exactly one day, which cancels out one day
// of real elapsed time in todaysCap()'s calculation — no separate "current
// ramp step" column needed.
// ponytail: attributes bounces/complaints to a domain via
// `campaign.fromEmail` — a tx send (no Campaign row) can't be attributed to
// any domain this way, so it never counts toward a rate here. Add a
// `fromDomain` column on Bounce directly if tx-send reputation needs to
// factor in too.
async function holdWarmupIfUnhealthy(domain: Domain): Promise<void> {
  const daysSince = Math.floor((Date.now() - domain.warmupStartedAt.getTime()) / 86_400_000);
  if (daysSince < 1 || daysSince >= RAMP_SCHEDULE.length) return; // nothing to evaluate yet, or ramp already done

  const yesterday = todayUtc(new Date(Date.now() - 86_400_000));
  const sentYesterday = await domainsRepository.getTodaySentCount(domain.id, yesterday);
  if (sentYesterday < MIN_VOLUME_FOR_RATE_CHECK) return;

  const start = new Date(`${yesterday}T00:00:00.000Z`);
  const end = new Date(`${todayUtc()}T00:00:00.000Z`);
  const fromDomainFilter = { campaign: { fromEmail: { endsWith: `@${domain.domain}` } }, createdAt: { gte: start, lt: end } };
  const [bounces, complaints] = await Promise.all([
    prisma.bounce.count({ where: { ...fromDomainFilter, type: { in: ["hard", "soft"] } } }),
    prisma.bounce.count({ where: { ...fromDomainFilter, type: "complaint" } }),
  ]);

  const bounceRate = bounces / sentYesterday;
  const complaintRate = complaints / sentYesterday;
  if (bounceRate > BOUNCE_RATE_HOLD_THRESHOLD || complaintRate > COMPLAINT_RATE_HOLD_THRESHOLD) {
    await domainsRepository.update(domain.tenantId, domain.id, {
      warmupStartedAt: new Date(domain.warmupStartedAt.getTime() + 86_400_000),
    });
  }
}

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;

export interface DnsRecord {
  type: "TXT" | "MX" | "A" | "PTR";
  name: string;
  value: string;
  note?: string;
  status: "pending" | "verified" | "failed";
}

export const domainsService = {
  async list(tenantId: number) {
    const domains = await domainsRepository.findAll(tenantId);
    return Promise.all(
      domains.map(async (d) => ({
        ...d,
        todaysCap: todaysCap(d.warmupStartedAt, d.maxDailyCap),
        sentToday: await domainsRepository.getTodaySentCount(d.id, todayUtc()),
      }))
    );
  },

  async get(tenantId: number, id: number) {
    const domain = await domainsRepository.findById(tenantId, id);
    if (!domain) throw ApiError.notFound("Domain not found");
    return domain;
  },

  async create(tenantId: number, input: { domain: string; maxDailyCap?: number }) {
    const domain = input.domain.trim().toLowerCase();
    if (!DOMAIN_RE.test(domain)) throw ApiError.badRequest("Not a valid domain name");
    if (await domainsRepository.findByName(domain)) throw ApiError.conflict("Domain already added");

    const created = await domainsRepository.create(tenantId, domain, env.mta.dkimSelector, input.maxDailyCap ?? 5000);

    // Recreates the mta container so OpenDKIM generates a key for this
    // domain. Runs in the background — the container takes a few seconds to
    // come back up, so the DKIM record isn't available immediately; the
    // frontend polls GET /domains/:id/dns-records until it appears.
    const allDomains = await domainsRepository.listNames();
    syncMtaDomains(allDomains).catch((err) => console.error("failed to sync mta domains:", err));

    return created;
  },

  async remove(tenantId: number, id: number) {
    await domainsService.get(tenantId, id);
    await domainsRepository.remove(tenantId, id);
    const allDomains = await domainsRepository.listNames();
    syncMtaDomains(allDomains).catch((err) => console.error("failed to sync mta domains:", err));
  },

  async setWarmup(tenantId: number, id: number, input: { maxDailyCap?: number; restartWarmup?: boolean }) {
    await domainsService.get(tenantId, id);
    return domainsRepository.update(tenantId, id, {
      maxDailyCap: input.maxDailyCap,
      warmupStartedAt: input.restartWarmup ? new Date() : undefined,
    });
  },

  // What to paste into Cloudflare, each tagged with its last-checked
  // Pending/Verified/Failed status (see verify() below for the live check).
  async getDnsRecords(tenantId: number, id: number): Promise<{ ready: boolean; records: DnsRecord[] }> {
    const domain = await domainsService.get(tenantId, id);
    const records: DnsRecord[] = [];

    if (env.mta.serverIp) {
      records.push({
        type: "TXT",
        name: domain.domain,
        value: `v=spf1 ip4:${env.mta.serverIp} ~all`,
        note: "SPF — authorizes this server to send as your domain",
        status: domain.spfStatus,
      });
    } else {
      records.push({
        type: "TXT",
        name: domain.domain,
        value: "(set SERVER_PUBLIC_IP in .env to generate this)",
        note: "SPF — blocked on knowing your server's public IP",
        status: "pending",
      });
    }

    const dkimValue = await readDkimPublicKeyRecord(domain.domain, domain.dkimSelector);
    const dkimReady = dkimValue !== null;
    records.push({
      type: "TXT",
      name: `${domain.dkimSelector}._domainkey.${domain.domain}`,
      value: dkimValue ?? "(generating — check back in a few seconds)",
      note: "DKIM — signs every outgoing message so receivers can verify it's really from you",
      status: domain.dkimStatus,
    });

    records.push({
      type: "TXT",
      name: `_dmarc.${domain.domain}`,
      value: `v=DMARC1; p=quarantine; rua=mailto:postmaster@${domain.domain}`,
      note: "DMARC — tells receivers what to do if SPF/DKIM fail",
      status: domain.dmarcStatus,
    });

    const mxHost = env.mta.hostname ?? domain.domain;
    records.push({
      type: "MX",
      name: domain.domain,
      value: `10 ${mxHost}`,
      note: "Optional — only needed if you want to receive bounces/replies on this domain",
      status: domain.mxStatus,
    });
    if (env.mta.hostname && env.mta.serverIp) {
      records.push({
        type: "A",
        name: env.mta.hostname,
        value: env.mta.serverIp,
        note: "Points your mail hostname at this server — required if MX above is used",
        status: "pending",
      });
    }

    // Server-IP-level, not per-domain — every domain's records page shows
    // the same result, since it's the same server. Nothing to "fix" here
    // (unlike SPF/DKIM/DMARC/MX, this isn't a DNS zone record you control);
    // it's set by whoever hosts the IP, hence no `value` to paste anywhere.
    const ptr = await verifyPtr(env.mta.serverIp);
    records.push({
      type: "PTR",
      name: env.mta.serverIp ?? "(SERVER_PUBLIC_IP not set)",
      value: ptr.ptrHostname ?? "—",
      note: ptr.note,
      status: ptr.status,
    });

    return { ready: dkimReady, records };
  },

  // Live DNS lookups — turns each record from "pending" into
  // "verified"/"failed" instead of just trusting the admin pasted them in.
  async verify(tenantId: number, id: number) {
    const domain = await domainsService.get(tenantId, id);
    const statuses = await verifyDomainDns(domain);
    return domainsRepository.setDnsStatus(tenantId, id, statuses);
  },

  // Called by the campaign dispatcher before each send.
  async canSendOne(domainName: string): Promise<boolean> {
    const domain = await domainsRepository.findByName(domainName);
    if (!domain) return true; // unmanaged domain — no cap enforced

    const sent = await domainsRepository.getTodaySentCount(domain.id, todayUtc());
    // The first send attempt of a new UTC day is also the one moment to
    // check yesterday's health — reuses the count we already fetched above
    // instead of a separate "have we checked today" flag/column.
    if (sent === 0) await holdWarmupIfUnhealthy(domain);

    const cap = todaysCap(domain.warmupStartedAt, domain.maxDailyCap);
    return sent < cap;
  },

  async recordSend(domainName: string) {
    const domain = await domainsRepository.findByName(domainName);
    if (!domain) return;
    await domainsRepository.incrementTodaySentCount(domain.id, todayUtc());
  },
};
