# Contributing to Mailrova

Thanks for considering a contribution. This is a small project — the process
is intentionally light.

## Dev setup

```bash
git clone git@github.com:Mubashir-teapot/MAILROVA.git
cd MAILROVA
cp .env.example .env
# edit .env — at minimum set JWT_SECRET to a real random value
docker compose up --build
```

See the main [README](./README.md) for the full quick-start (local dev
access, since services publish no host ports by default) and the
[Tests](./README.md#tests) section for running the backend suite.

## Code style

- TypeScript everywhere, `strict` on. No `any` beyond what's already in the
  codebase — prefer a real type.
- Backend: Express + Prisma, one module per feature under
  `backend/src/modules/<feature>/` — `*.controller.ts` (routing + validation
  via Zod) → `*.service.ts` (business logic) → `*.repository.ts` (Prisma
  queries, always scoped by `tenantId`). Follow an existing module (e.g.
  `roles/`) as the template for a new one.
- Frontend: Next.js App Router, plain `useState`/`fetch` via the shared
  `api` client — no state management library. SVG icons only
  (`src/components/icons.tsx`'s `Base` pattern), never emoji, matching the
  existing "clean, not AI-looking" visual style.
- Run `npm run typecheck` (backend) and `tsc --noEmit` (frontend) before
  opening a PR — both are expected to be clean.
- No new dependency for something a few lines of code already does. If
  you're reaching for a library, check whether the codebase already has a
  pattern for it first.

## Security-sensitive changes

Every mutating repository query must be scoped by `{id, tenantId}` (or the
tenant-equivalent) — this is the single most important invariant in the
codebase (see `backend/tests/tenantIsolation.test.ts`). If you touch a
repository, add or extend a tenant-isolation test for it.

For anything touching auth, sending, or secrets — see [SECURITY.md](./SECURITY.md)
first, and read the existing `common/middleware/`, `common/utils/sanitizeEmailHtml.ts`,
and `common/audit/auditLog.ts` for the patterns already in place before adding a new one.

## Pull requests

- Keep PRs focused — one change, one PR, easier to review.
- Explain the *why* in the description, not just the what.
- Add a test for new backend logic where it's practical (see the existing
  suite in `backend/tests/` for the pattern — real Postgres, not mocks,
  except for pure functions like DNS verification).

## Reporting bugs / requesting features

Open a GitHub issue. For anything that looks like a security issue, see
[SECURITY.md](./SECURITY.md) instead — please don't open a public issue for
those.
