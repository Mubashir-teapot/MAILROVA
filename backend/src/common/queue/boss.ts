import { PgBoss } from "pg-boss";
import { env } from "../../config/env";

export const SEND_EMAIL_QUEUE = "send-email";

// Uses the same Postgres instance as everything else (its own connection
// pool, not Prisma's) — no separate infra service. Jobs are persisted in
// Postgres and claimed with row-level locking, which is what actually fixes
// both "duplicate sends on a crash mid-dispatch" (a job is atomically
// claimed before the handler runs, see campaigns.worker.ts) and "no retry on
// transient failure" (retryLimit/retryBackoff below) that the old in-process
// fire-and-forget dispatch loop had.
export const boss = new PgBoss(env.databaseUrl);

let started = false;

export async function startQueue() {
  if (started) return;
  started = true;
  boss.on("error", (err) => console.error("pg-boss error:", err));
  await boss.start();
  await boss.createQueue(SEND_EMAIL_QUEUE, {
    retryLimit: 5,
    retryBackoff: true,
    retryDelay: 30,
    retryDelayMax: 3600,
    expireInSeconds: 120,
  });
}

export async function stopQueue() {
  if (!started) return;
  started = false;
  await boss.stop({ graceful: true });
}
