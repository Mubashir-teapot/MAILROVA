import { DnsCheckStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";

export const domainsRepository = {
  findAll(tenantId: number) {
    return prisma.domain.findMany({ where: { tenantId }, orderBy: { id: "asc" } });
  },
  findById(tenantId: number, id: number) {
    return prisma.domain.findFirst({ where: { id, tenantId } });
  },
  // Global (not tenant-scoped) — a real DNS name can only ever belong to one
  // tenant, and the warmup-cap check in campaign dispatch only has the bare
  // domain string to go on.
  findByName(domain: string) {
    return prisma.domain.findUnique({ where: { domain } });
  },
  // Global on purpose — the self-hosted mail server is one shared container
  // for the whole platform, so it needs every tenant's domains, not just one.
  listNames() {
    return prisma.domain.findMany({ select: { domain: true } }).then((rows) => rows.map((r) => r.domain));
  },
  create(tenantId: number, domain: string, dkimSelector: string, maxDailyCap: number) {
    return prisma.domain.create({ data: { tenantId, domain, dkimSelector, maxDailyCap } });
  },
  update(tenantId: number, id: number, data: { maxDailyCap?: number; warmupStartedAt?: Date }) {
    return prisma.domain.update({ where: { id, tenantId }, data });
  },
  remove(tenantId: number, id: number) {
    return prisma.domain.delete({ where: { id, tenantId } });
  },

  setDnsStatus(
    tenantId: number,
    id: number,
    status: { spfStatus?: DnsCheckStatus; dkimStatus?: DnsCheckStatus; dmarcStatus?: DnsCheckStatus; mxStatus?: DnsCheckStatus }
  ) {
    return prisma.domain.update({ where: { id, tenantId }, data: { ...status, lastVerifiedAt: new Date() } });
  },

  async getTodaySentCount(domainId: number, date: string) {
    const row = await prisma.domainSendCount.findUnique({ where: { domainId_date: { domainId, date } } });
    return row?.count ?? 0;
  },
  incrementTodaySentCount(domainId: number, date: string) {
    return prisma.domainSendCount.upsert({
      where: { domainId_date: { domainId, date } },
      create: { domainId, date, count: 1 },
      update: { count: { increment: 1 } },
    });
  },
};
