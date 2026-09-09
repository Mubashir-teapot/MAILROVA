import rateLimit from "express-rate-limit";

// Login endpoints get their own strict limiter (brute-force protection) —
// keyed on IP, since neither login attempt carries a session yet.
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
});

// Baseline DoS guard on every /api/* request.
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests." },
});

// /api/public/* and bounce webhooks are unauthenticated by design (opt-in
// links, ESP callbacks) — looser than the login limiter but still bounded.
export const publicRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests." },
});
