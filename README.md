# Mailrova

Open-source, self-hosted email marketing platform. Built by
[UA Technologies](https://ua-technologies.com).

A self-hosted, multi-tenant email marketing platform: campaigns, subscriber
lists, a visual template builder, transactional email, and its own outbound
mail server (Postfix + OpenDKIM). No paid SMTP provider is required, though a
third-party provider (SES, SendGrid, MXroute, ...) works too via one env
switch.

## Requirements

- Docker + Docker Compose v2 (`docker compose`, not `docker-compose`)
- For self-hosted sending: outbound TCP port 25 open on the host (most home
  ISPs and some cloud providers block this, check with your host; Hostinger
  and most real VPS/dedicated providers allow it)
- Nothing else, Node, Postgres, etc. all run inside containers

## Quick start (local dev)

```bash
git clone git@github.com:Mubashir-teapot/MAILROVA.git
cd MAILROVA
cp .env.example .env
# edit .env: at minimum set JWT_SECRET to a long random string
docker compose up --build
```

First boot will:
1. Start Postgres and wait for it to be healthy
2. Start the `mta` (Postfix) container
3. Start the backend, which runs `prisma db push` to create the schema, then
   seeds a platform admin and a default tenant + admin user (see below)
4. Start the frontend (Next.js dev server)

`db`, `backend`, and `frontend` publish no host ports; they're only
reachable from other containers on the compose network (`db:5432`,
`backend:4000`, `frontend:5173`). That's deliberate: in production behind
Dokploy/Traefik (see below), nothing should be reachable except through the
reverse proxy. For local dev, reach them with:

```bash
docker compose exec backend sh -c "wget -qO- http://localhost:4000/api/health"  # sanity check
```

or, to browse the app locally, temporarily publish ports without touching
the tracked `docker-compose.yml`, create `docker-compose.override.yml`
(already gitignored) with:

```yaml
services:
  frontend:
    ports:
      - "5173:5173"
  backend:
    ports:
      - "4000:4000"
```

then `docker compose up --build` again and open:
- **App**: `http://localhost:5173` → redirects to `/admin/login`
- **Platform admin** (manage tenants): `http://localhost:5173/platform/login`
- **API**: `http://localhost:4000/api`

### First-login credentials

If you left `ADMIN_PASSWORD` / `PLATFORM_ADMIN_PASSWORD` blank in `.env`, the
backend generates random passwords on first boot and prints them once to its
logs:

```bash
docker compose logs backend | grep -A2 "seeded"
```

Log in, then change the password from the app (or set the env vars up front
next time and start clean).

### Stopping / resetting

```bash
docker compose down            # stop, keep data (db, uploads, DKIM keys)
docker compose down -v         # stop and wipe all volumes, fresh start
```

### Useful day-to-day commands

```bash
docker compose logs -f backend        # tail backend logs
docker compose logs -f mta            # tail mail server logs
docker compose restart backend        # restart just the API
docker compose exec backend sh        # shell into the backend container
docker compose exec db psql -U mailrova -d mailrova   # psql console
```

## Sending mail

One switch in `.env`: **`MAIL_MODE`**

- `self_hosted` (default): routes through the bundled `mta` container (real
  Postfix, direct-to-MX delivery, no relay, DKIM-signed). Needs:
  - Outbound port 25 open on the host
  - At least one domain added and verified from the **Domains** page in the
    app, this generates the SPF/DKIM/DMARC/MX records you paste into your
    DNS provider, and a **Verify DNS** button that live-checks them
  - `SERVER_PUBLIC_IP` set in `.env` (used to generate a correct SPF record)
- `third_party`: fill in `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` /
  `SMTP_PASS` / `SMTP_SECURE` for any provider (SES, SendGrid, Postmark,
  MXroute, etc.) and set `MAIL_MODE=third_party`. Nothing else in the app
  changes either way, same campaigns, same UI, same delivery logs.

Sending also respects, per tenant/domain/mailbox:
- A daily send-rate warmup ramp per newly-added domain
- A per-mailbox daily send cap
- A per-tenant sends-per-minute throttle (`SEND_RATE_PER_MINUTE`, also
  editable live from **Settings** in the app, no restart needed)
- A suppression list (bounces/unsubscribes are never sent to again)
- One-click `List-Unsubscribe` headers on every campaign, no login required

The campaign scheduler poll interval (`CAMPAIGN_SCHEDULER_INTERVAL_MS`) is
editable live from the **Platform Admin** dashboard, it re-reads its
interval every cycle, so changing it takes effect without a restart.

## Multi-tenancy

Each tenant is resolved by the hostname the request came in on
(`DEFAULT_TENANT_HOSTNAME` for the seeded tenant). To add another
organization on its own (sub)domain:

1. Log in to `/platform/login` with the platform admin account
2. Create a tenant and attach the hostname(s) it should answer on
3. Point that hostname's DNS at this server
4. Anyone visiting that hostname now sees an isolated Mailrova instance,
   with separate users, lists, campaigns, domains, everything

## Media storage

`.env` → `MEDIA_PROVIDER`:
- `filesystem` (default): stored in the `backend_uploads` Docker volume
- `s3`: AWS S3 or any S3-compatible store, including Cloudflare R2 (set
  `S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com` and
  `S3_FORCE_PATH_STYLE=true`)

## Tests

Backend integration tests run against a real (disposable) Postgres database,
the same `db` service, but a different database inside it:

```bash
docker compose exec db psql -U mailrova -c "CREATE DATABASE mailrova_test"   # once
cp backend/.env.test.example backend/.env.test                               # once, edit if needed
docker compose exec backend npm test
```

(Runs from inside the container, since `db` publishes no host port; see
"Production deployment" below.) Priority coverage: tenant isolation (every
resource type, the top-priority case), campaign retry/dedup logic, the
suppression list, auth (session + API key), and DNS verification. This is a
focused suite on the areas that were explicitly hardened, not exhaustive
coverage of every endpoint.

## Stack

- **Backend**: Express + TypeScript, PostgreSQL via Prisma
- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind
- **Mail**: self-hosted Postfix/OpenDKIM (`mta` service) for direct-to-MX
  sending, or any third-party SMTP provider
- **Multi-tenant**: one deployment can serve multiple organizations, each
  resolved by hostname, fully data-isolated
- **Auth**: HttpOnly secure session cookies (JWT-signed), never localStorage.
  Tenant users and the platform admin have separate, independent sessions.
- Everything runs via Docker Compose: 4 services, `db`, `mta`, `backend`, `frontend`

## Project layout

```
backend/                 Express API, one module per feature
  src/modules/*/          <feature>.controller.ts / .service.ts / .repository.ts / .routes.ts
  src/common/              shared middleware, mailer, docker control, utils
  src/config/               env parsing, prisma client
  prisma/schema.prisma      DB schema
frontend/                Next.js 16 App Router app
  app/                      pages (admin app, /admin/login, /platform)
  src/                      api client, auth contexts, components, template editor
docker-compose.yml       db + mta + backend + frontend
.env.example             every variable, documented inline
FEATURES.md              feature deep-dive this project was scoped against
```

## Production deployment (Dokploy)

**Only the frontend is ever exposed to the internet.** `db`, `backend`, and
`mta`'s DKIM/management side publish no host ports and get no public
domain. `db`/`backend` are `expose`-only (container-network-only), reachable
solely from other containers. The browser never talks to the backend
directly: `frontend`'s Next.js server proxies every `/api/*` request to it
internally (`frontend/next.config.js`), including unauthenticated links like
unsubscribe/opt-in that get clicked from outside any browser session. Those
also go `https://app.yourdomain.com/api/...` → proxied → `backend:4000`.
This is built for [Dokploy](https://dokploy.com) (Traefik under the hood):

1. Push this repo, add it as a **Docker Compose** application in Dokploy.
2. Set your real values as environment variables in the Dokploy UI (or point
   it at your own `.env`, see `.env.example` for the full list). Critically,
   set **`PUBLIC_URL`** to the frontend's real public domain (e.g.
   `https://app.yourdomain.com`), not the backend's, since the backend has
   no domain of its own. Leave `NEXT_PUBLIC_API_URL` as the default `/api`.
3. Deploy. Dokploy attaches its own `dokploy-network` to every service and
   injects Traefik labels automatically, no manual labels needed in the
   compose file.
4. In the app's **Domains** tab, add **one** domain, for `frontend` →
   container port `5173` (e.g. `app.yourdomain.com`). Do **not** add one for
   `backend`; it should stay unreachable except from `frontend` itself.
5. `mta` (port 25) is unrelated to all of the above and still needs to be
   open, see below.

This also works with any other Traefik/Caddy/nginx setup that isn't
Dokploy: just attach `frontend` to whatever network your proxy uses and
route to `frontend:5173`; `backend` needs nothing attached to it at all.

### About port 25

Yes, it's still needed, and this is a separate question from the
frontend-only-exposure setup above. SMTP (`mta`) and HTTP (Traefik/Dokploy
domain routing) are two unrelated protocols on two unrelated ports. Making
only the frontend reachable over HTTP doesn't change anything about how mail
gets sent: `self_hosted` mode still needs `mta` to speak real SMTP,
direct-to-MX, to the rest of the internet's mail servers on port 25; that
traffic never goes anywhere near Traefik or the frontend. If you don't care
about *receiving* mail (bounces/replies) on your sending domain you could in
principle drop the `ports: ["25:25"]` line and outbound sending still works,
but in practice leave it published: bounce handling depends on it, and most
providers you're delivering to also do reverse-DNS/greet checks that are
easier to pass with a normally-listening port 25. A host can only have one
thing bound to it: if this VPS already runs another mail server, `docker
compose up` fails loudly with "port is already allocated" instead of
silently colliding; find and free it with `sudo ss -tlnp | grep :25`, or run
mail on a dedicated IP if the host has more than one.

- Set real values in `.env`: strong `JWT_SECRET`, real `PUBLIC_URL` (the
  frontend's domain), `CORS_ORIGINS`, `SERVER_PUBLIC_IP`.
- The backend talks to a `docker-proxy` sidecar (`tecnativa/docker-socket-proxy`,
  see `docker-compose.yml`) to restart the `mta` container when you add or
  remove a sending domain from the UI. It's scoped to just container
  inspect/create/start/stop/remove, not full Docker socket access. If you'd
  rather not grant even that, remove the `docker-proxy` service and the
  backend's dependency on it, and manage `mta`'s `ALLOWED_SENDER_DOMAINS` by
  hand instead.
- Back up the `db_data` volume (Postgres) and `mta_dkim_keys` volume (DKIM
  private keys; losing these breaks signing for existing domains).

### Deploying without Dokploy's auto-deploy / a GitHub webhook

If you deploy by `git pull`-ing on the server yourself rather than through
Dokploy's GitHub integration, a plain `git pull` does **not** rebuild
anything, you'd have to remember to separately run `docker compose up
--build -d` every time. A git hook fixes that: after every `git pull`, it
rebuilds and restarts automatically (cheaply, `docker compose` skips
rebuilding a service whose build context didn't change).

One-time setup on the server (git hooks aren't tracked/copied by git itself,
so this can't install itself):
```bash
cp scripts/git-hooks/post-merge .git/hooks/post-merge
chmod +x .git/hooks/post-merge
```
From then on, every `git pull` on that checkout rebuilds and restarts
whatever changed, no separate `--build` step to remember.

## Notes

- `listmonk-master/` (if present) is reference material only, gitignored,
  not part of this project.
- `.env` is gitignored; copy `.env.example` and fill in real secrets locally.
- Never commit `.env`, only `.env.example` is tracked.

## License

```
MAILROVA - Open-source self-hosted email marketing platform.
Copyright (C) 2026 UA Technologies

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License v3.0.
```

Full text in [LICENSE](./LICENSE). Website: [ua-technologies.com](https://ua-technologies.com).
