import { prisma } from "../../config/prisma";
import { getSchedulerIntervalMs } from "../platform/platformSettings";
import { campaignsService } from "./campaigns.service";

// Polls for campaigns whose admin-set `sendAt` has arrived and starts them.
// Self-reschedules with whatever the poll interval currently is (read live
// from PlatformSetting each cycle) instead of a fixed setInterval — so
// changing it from the platform admin UI takes effect on the very next
// tick, no container restart needed.
// ponytail: still just polling, no persistent job queue — fine at this
// scale; swap for a real scheduler (BullMQ/pg-boss) if send volume needs
// retries surviving a process restart mid-dispatch.
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

      // Resume anything already "running" that stalled (warmup/mailbox cap
      // hit, or the process restarted mid-send) — dispatch() is idempotent.
      await campaignsService.resumeRunning();
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
