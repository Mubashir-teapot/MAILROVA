/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The browser only ever talks to this frontend's own domain — never a
  // separate backend domain. Every /api/* request (from the SPA, or from
  // someone clicking an unsubscribe/opt-in link in an email) lands here
  // first and gets forwarded server-side, over the internal Docker network,
  // to the backend. Only this frontend needs a public Domain in Dokploy.
  async rewrites() {
    const backend = process.env.BACKEND_INTERNAL_URL ?? `http://backend:${process.env.BACKEND_PORT ?? 4000}`;
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

module.exports = nextConfig;
