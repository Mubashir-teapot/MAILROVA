import bcrypt from "bcryptjs";
import { ApiError } from "../../common/utils/ApiError";
import { prisma } from "../../config/prisma";
import { mailboxesRepository } from "./mailboxes.repository";
import { todayUtc } from "../domains/warmup";

export const mailboxesService = {
  list(tenantId: number) {
    return mailboxesRepository.findAll(tenantId);
  },

  mine(tenantId: number, userId: number) {
    return mailboxesRepository.findByUser(tenantId, userId);
  },

  async create(tenantId: number, input: { domainId: number; email: string; name: string; password?: string; dailyCap?: number }) {
    const domain = await prisma.domain.findFirst({ where: { id: input.domainId, tenantId } });
    if (!domain) throw ApiError.notFound("Domain not found");
    const email = input.email.toLowerCase();
    if (!email.endsWith(`@${domain.domain}`)) throw ApiError.badRequest(`Email must end with @${domain.domain}`);

    const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : null;
    return mailboxesRepository.create(tenantId, input.domainId, email, input.name, passwordHash, input.dailyCap ?? 100);
  },

  async get(tenantId: number, id: number) {
    const mailbox = await mailboxesRepository.findById(tenantId, id);
    if (!mailbox) throw ApiError.notFound("Mailbox not found");
    return mailbox;
  },

  async setPassword(tenantId: number, id: number, password: string) {
    await mailboxesService.get(tenantId, id);
    const passwordHash = await bcrypt.hash(password, 10);
    return mailboxesRepository.update(tenantId, id, { passwordHash });
  },

  async setEnabled(tenantId: number, id: number, enabled: boolean) {
    await mailboxesService.get(tenantId, id);
    return mailboxesRepository.update(tenantId, id, { enabled });
  },

  async setDailyCap(tenantId: number, id: number, dailyCap: number) {
    await mailboxesService.get(tenantId, id);
    return mailboxesRepository.update(tenantId, id, { dailyCap });
  },

  async remove(tenantId: number, id: number) {
    await mailboxesService.get(tenantId, id);
    await mailboxesRepository.remove(tenantId, id);
  },

  async assignUsers(tenantId: number, id: number, userIds: number[]) {
    await mailboxesService.get(tenantId, id);
    await mailboxesRepository.setUsers(id, userIds);
  },

  // Called by the campaign dispatcher before each send — enforces the
  // per-mailbox cap in addition to the domain-wide one.
  async canSendOne(email: string): Promise<boolean> {
    const mailbox = await mailboxesRepository.findByEmail(email.toLowerCase());
    if (!mailbox) return true; // not a managed mailbox — only the domain cap applies
    if (!mailbox.enabled) return false;
    const sent = await mailboxesRepository.getTodaySentCount(mailbox.id, todayUtc());
    return sent < mailbox.dailyCap;
  },

  async recordSend(email: string) {
    const mailbox = await mailboxesRepository.findByEmail(email.toLowerCase());
    if (!mailbox) return;
    await mailboxesRepository.incrementTodaySentCount(mailbox.id, todayUtc());
  },
};
