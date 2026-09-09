// Daily send-volume ramp for a newly added sending domain. A brand-new
// domain/IP has no reputation with receiving mail providers — sending full
// volume on day one gets flagged as spam. Ramping up gradually over ~2 weeks
// is the standard practice; after that, `maxDailyCap` applies.
export const RAMP_SCHEDULE = [50, 100, 200, 350, 500, 750, 1000, 1500, 2000, 3000, 4000];

export function todaysCap(warmupStartedAt: Date, maxDailyCap: number): number {
  const daysSince = Math.floor((Date.now() - warmupStartedAt.getTime()) / 86_400_000);
  if (daysSince < 0) return RAMP_SCHEDULE[0];
  if (daysSince >= RAMP_SCHEDULE.length) return maxDailyCap;
  return Math.min(RAMP_SCHEDULE[daysSince], maxDailyCap);
}

export function todayUtc(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

// If yesterday's bounce/complaint rate for a domain crossed these, the ramp
// holds at its current step instead of advancing — standard warmup-guide
// practice (a fresh IP/domain that starts bouncing needs its volume capped
// where it is, not pushed higher). Deliberately conservative: real ESPs use
// thresholds in this same range (low single-digit % bounce, ~0.1% complaint).
export const BOUNCE_RATE_HOLD_THRESHOLD = 0.05;
export const COMPLAINT_RATE_HOLD_THRESHOLD = 0.001;
// Below this many sends, a rate isn't statistically meaningful enough to
// act on (one bounce out of 3 sends is not a 33% bounce rate problem).
export const MIN_VOLUME_FOR_RATE_CHECK = 20;
