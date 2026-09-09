import { PrismaClient } from "@prisma/client";

// ponytail: single shared client, no connection-pool tuning yet — add if throughput demands it.
export const prisma = new PrismaClient();
