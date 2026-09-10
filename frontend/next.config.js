/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The browser only ever talks to this frontend's own domain — never a
  // separate backend domain. Every /api/* request (from the SPA, or from
  // someone clicking an unsubscribe/opt-in link in an email) lands here
  // first and gets forwarded server-side, over the internal Docker network,
  // to the backend. Only this frontend needs a public Domain in Dokploy.
  async rewrites() {
    // "backend" (the bare compose service name) is generic enough to
    // collide with another project's same-named service on a shared Docker
    // host — docker-compose.yml gives the backend service the host-wide-
    // unique container_name "mailrova-backend" specifically so this can't
    // happen; BACKEND_INTERNAL_URL still overrides both for non-compose setups.
    const backend = process.env.BACKEND_INTERNAL_URL ?? `http://mailrova-backend:${process.env.BACKEND_PORT ?? 4000}`;
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      // Uploaded media (filesystem.storage.ts) is served by the backend at
      // /uploads/*, outside /api — without this, the Media page's thumbnails
      // and any image inserted into a template 404 in the browser, since
      // only /api/* was ever forwarded to the backend.
      { source: "/uploads/:path*", destination: `${backend}/uploads/:path*` },
    ];
  },
};

module.exports = nextConfig;
