import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "mailrova_session";

// Fast, edge-level redirect for UX (no flash of the app shell before
// bouncing to login). This only checks the cookie's *presence* — it can't
// verify the JWT signature without importing Node crypto into the Edge
// runtime, and it doesn't need to: the real security boundary is the
// backend's requireAuth on every API call, which the axios client already
// redirects on if a stale/invalid cookie gets a 401 back.
//
// /platform/* is a separate login (platform admins manage tenants, not a
// member of one) with its own cookie — guarded client-side in
// app/platform/layout.tsx instead, so it's excluded here entirely.
//
// /api/* must also be excluded: this gate redirects (a page navigation
// concern), but a redirected POST/PUT/etc. gets re-sent as the same method
// to the new location (307 preserves it) — so an unauthenticated call to
// e.g. /api/auth/login itself would get redirected to /admin/login, which
// only accepts GET, turning every login attempt into a 405 before it ever
// reached the backend. API auth is already enforced by the backend's own
// requireAuth on every call; this gate is only for the app shell.
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/platform") || req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has(SESSION_COOKIE);
  const isLoginPage = req.nextUrl.pathname.startsWith("/admin/login");

  if (!hasSession && !isLoginPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && isLoginPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Static files under /public (logos, favicons, ...) must stay reachable
  // even when logged out — the login page itself references them — so
  // common static-asset extensions are excluded alongside _next/* and
  // favicon.ico, not just that one literal filename.
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|svg|webp|gif)$).*)"],
};
