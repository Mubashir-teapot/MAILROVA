import { prisma } from "../../config/prisma";

export const mailboxesRepository = {
  findAll(tenantId: number) {
    return prisma.mailbox.findMany({
      where: { tenantId },
      orderBy: { id: "asc" },
      include: { domain: true, users: { include: { user: { select: { id: true, username: true } } } } },
    });
  },

  findById(tenantId: number, id: number) {
    return prisma.mailbox.findFirst({ where: { id, tenantId }, include: { domain: true } });
  },

  findByEmail(email: string) {
    return prisma.mailbox.findUnique({ where: { email } });
  },

  findByUser(tenantId: number, userId: number) {
    return prisma.mailbox.findMany({
      where: { tenantId, enabled: true, users: { some: { userId } } },
      include: { domain: true },
    });
  },

  create(tenantId: number, domainId: number, email: string, name: string, passwordHash: string | null, dailyCap: number) {
    return prisma.mailbox.create({ data: { tenantId, domainId, email, name, passwordHash, dailyCap } });
  },

  update(tenantId: number, id: number, data: { name?: string; passwordHash?: string; enabled?: boolean; dailyCap?: number }) {
    return prisma.mailbox.update({ where: { id, tenantId }, data });
  },

  remove(tenantId: number, id: number) {
    return prisma.mailbox.delete({ where: { id, tenantId } });
  },

  setUsers(mailboxId: number, userIds: number[]) {
    return prisma.$transaction([
      prisma.userMailbox.deleteMany({ where: { mailboxId } }),
      prisma.userMailbox.createMany({ data: userIds.map((userId) => ({ userId, mailboxId })) }),
    ]);
  },

  async getTodaySentCount(mailboxId: number, date: string) {
    const row = await prisma.mailboxSendCount.findUnique({ where: { mailboxId_date: { mailboxId, date } } });
    return row?.count ?? 0;
  },
  incrementTodaySentCount(mailboxId: number, date: string) {
    return prisma.mailboxSendCount.upsert({
      where: { mailboxId_date: { mailboxId, date } },
      create: { mailboxId, date, count: 1 },
      update: { count: { increment: 1 } },
    });
  },
};
