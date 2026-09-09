// Daily send-volume ramp for a newly added sending domain. A brand-new
// domain/IP has no reputation with receiving mail providers — sending full
// volume on day one gets flagged as spam. Ramping up gradually over ~2 weeks
// is the standard practice; after that, `maxDailyCap` applies.
const RAMP_SCHEDULE = [50, 100, 200, 350, 500, 750, 1000, 1500, 2000, 3000, 4000];

export function todaysCap(warmupStartedAt: Date, maxDailyCap: number): number {
  const daysSince = Math.floor((Date.now() - warmupStartedAt.getTime()) / 86_400_000);
  if (daysSince < 0) return RAMP_SCHEDULE[0];
  if (daysSince >= RAMP_SCHEDULE.length) return maxDailyCap;
  return Math.min(RAMP_SCHEDULE[daysSince], maxDailyCap);
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
