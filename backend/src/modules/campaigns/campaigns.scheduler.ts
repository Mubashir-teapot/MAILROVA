import { prisma } from "../../config/prisma";
import { getSchedulerIntervalMs } from "../platform/platformSettings";
import { campaignsService } from "./campaigns.service";

// Polls for campaigns whose admin-set `sendAt` has arrived, starts them, and
// (re-)enqueues eligible recipients for every "running" campaign — the
// actual sending happens in campaigns.worker.ts via pg-boss, this loop just
// decides *when* to top up the queue. Self-reschedules with whatever the
// poll interval currently is (read live from PlatformSetting each cycle)
// instead of a fixed setInterval — so changing it from the platform admin UI
// takes effect on the very next tick, no container restart needed.
export function startCampaignScheduler(fallbackIntervalMs: number) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    try {
      const due = await prisma.campaign.findMany({
        where: { status: "scheduled", sendAt: { lte: new Date() } },
        select: { id: true, tenantId: true },
      });

      for (const c of due) {
        try {
          await campaignsService.setStatus(c.tenantId, c.id, "running");
        } catch (err) {
          console.error(`scheduler: failed to start campaign ${c.id}:`, err);
        }
      }

      // Top up the queue for anything already "running" that stalled (a
      // warmup/mailbox cap, or a process restart) — enqueueEligible() is
      // idempotent, see its own comment.
      const running = await prisma.campaign.findMany({ where: { status: "running" }, select: { id: true, tenantId: true } });
      for (const c of running) {
        campaignsService
          .enqueueEligible(c.tenantId, c.id)
          .catch((err) => console.error(`scheduler: failed to enqueue campaign ${c.id}:`, err));
      }
    } catch (err) {
      console.error("scheduler tick failed:", err);
    }

    if (stopped) return;
    const intervalMs = await getSchedulerIntervalMs().catch(() => fallbackIntervalMs);
    timer = setTimeout(tick, intervalMs);
  };

  tick(); // run once immediately on boot so a missed window during downtime is caught up

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
