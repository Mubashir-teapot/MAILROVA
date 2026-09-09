# listmonk — Complete Feature & Architecture Reference

listmonk is a self-hosted, high-performance mailing list / newsletter / transactional email manager. It ships as a single Go binary plus a Vue 3 admin SPA, backed by a single PostgreSQL database (no Redis, no message broker, no external queue). This document explains **every feature**, **how each one works internally**, and specifically **how SMTP sending and marketing-campaign delivery work end to end**, based on a full read of the codebase at `listmonk-master/`.

Stack: Go backend (`cmd/`, `internal/`, `models/`), Vue 3 + Buefy frontend (`frontend/src/`), Postgres (schema in `schema.sql`, queries in `queries/*.sql`), static HTML e-mail/page templates (`static/`).

---

## 1. Core Concepts

| Concept | Definition |
|---|---|
| **Subscriber** | A recipient identified by e-mail + name. Can belong to any number of lists. Subscribers in no list are "orphans." |
| **List** | A named group of subscribers (`public`/`private`, `single`/`double` opt-in). Campaigns target one or more lists. |
| **Campaign** | A bulk e-mail (or other message) sent to one or more lists, with a lifecycle (draft → scheduled/running → finished). |
| **Transactional message** | A one-off, API-triggered message (password reset, receipt, welcome mail) sent outside the campaign/list system. |
| **Template** | A reusable Go-`html/template` HTML shell into which campaign or transactional content is injected. |
| **Messenger** | A pluggable delivery backend. Built-in: SMTP e-mail. Also supports arbitrary HTTP "postback" messengers (SMS/FCM/Slack/etc.). |
| **Tracking pixel / link tracking** | Invisible 1×1 image + rewritten links used to measure opens/clicks per campaign (optionally per-subscriber). |
| **Bounce** | A failed/rejected delivery, ingested via a POP3 mailbox or ESP webhooks, which can auto-blocklist/unsubscribe/delete a subscriber after N occurrences. |

---

## 2. Subscribers

**Files:** `models/subscribers.go`, `internal/core/subscribers.go`, `cmd/subscribers.go`, `queries/subscribers.sql`.

### Data model
```sql
subscribers(id, uuid, email UNIQUE (case-insensitive), name, attribs JSONB, status, created_at, updated_at)
```
- `status` (global, subscriber-wide): `enabled` | `disabled` | `blocklisted`. Governs whether the subscriber can receive **any** campaign at all.
- `attribs` — arbitrary schemaless JSON, e.g. `{"city":"Bengaluru","projects":3,"stack":{"languages":["go","python"]}}`. Used for segmentation (SQL queries below) and for personalization in templates (`{{ .Subscriber.Attribs.city }}`).
- `FirstName`/`LastName` are derived at render time by splitting `Name` on whitespace — not stored separately.

### Per-list subscription status
A separate join table `subscriber_lists(subscriber_id, list_id, status, meta JSONB)` tracks the relationship **per list**, independent of the subscriber's global status:

| Status | Meaning |
|---|---|
| `unconfirmed` | Added to the list but has not clicked to confirm. On a **single opt-in** list this still counts as subscribed and receives campaigns. On a **double opt-in** list it does **not** receive campaigns until confirmed. |
| `confirmed` | Clicked the double opt-in confirmation link. Required for double opt-in lists to receive mail. |
| `unsubscribed` | Opted out of that specific list; excluded from all future sends to that list. |

A subscriber can be `confirmed` on one list and `unsubscribed` on another simultaneously.

**Blocklist override (enforced in SQL):** `insert-subscriber` / `update-subscriber-with-lists` contain `CASE WHEN status='blocklisted' THEN 'unsubscribed' ELSE ... END` — any attempt to (re)subscribe a blocklisted person to a list is silently forced to `unsubscribed`, so blocklisting can never be bypassed by re-adding to a list.

### Single vs. double opt-in — the exact flow
1. Adding a subscriber to a list always inserts `subscriber_lists` with status `unconfirmed`.
2. If the global setting `app.send_optin_confirmation` is on and the insert wasn't `preconfirm_subscriptions=true`, listmonk queries which of the target lists are **double opt-in AND still unconfirmed** for this subscriber.
3. If none qualify (all lists are single opt-in, or all target lists are already confirmed), **no e-mail is sent**.
4. If some qualify, a confirmation e-mail (`subscriber-optin.html` template) is sent with an opt-in link containing the subscriber UUID and the relevant list UUIDs.
5. Clicking the link hits `/subscription/optin/:subUUID` (see §9), which — after an explicit confirm click (unless `app.show_optin_page` is off) — runs `confirm-subscription-optin`, flipping `unconfirmed → confirmed` for just those lists.
6. **Delivery logic**: a campaign sent to a double opt-in list only reaches subscribers with status `confirmed` on that list; a campaign to a single opt-in list reaches anyone not `unsubscribed`.

Bulk **CSV import does NOT trigger opt-in e-mails** — imported rows are inserted directly via SQL upsert (bypassing the app-level opt-in-notify hook) specifically to avoid a mass-email spike from a large import.

### Subscriber query language (advanced segmentation)
listmonk's most distinctive subscriber feature: admins can type a raw **partial Postgres SQL WHERE-clause** into the search box to filter/segment subscribers.

```sql
-- exact / partial match
subscribers.email = 'some@domain.com'
subscribers.email LIKE '%@domain.com'

-- multiple conditions
subscribers.name LIKE 'John%' AND subscribers.status = 'blocklisted'

-- who viewed a specific campaign
EXISTS(SELECT 1 FROM campaign_views WHERE campaign_views.subscriber_id=subscribers.id AND campaign_views.campaign_id=42)

-- JSON attribute queries (Postgres JSONB operators)
subscribers.attribs->>'city' = 'Bengaluru' AND (subscribers.attribs->>'projects')::INT > 3

-- nested attributes / arrays
subscribers.attribs->'stack'->'languages' ? 'python'
```

**How it's executed safely:**
- Gated behind the `subscribers:sql_query` permission — a dedicated, high-risk permission the docs explicitly warn should only go to trusted users, since it's a read-only window straight into the Postgres schema.
- The query is string-spliced (`%query%`) into a fixed query template (it can't be a prepared-statement parameter because it's a fragment of a WHERE clause, not a single value) — `queries/subscribers.sql`, marked `-- raw: true`.
- Before running the real query, listmonk runs `EXPLAIN (FORMAT JSON) <constructed query>` inside a **read-only transaction**, walks the JSON query plan, and extracts every `"Relation Name"` referenced. If any table outside an allowlist (`subscribers, lists, subscriber_lists, campaigns, campaign_lists, campaign_views, links, link_clicks, bounces`) is touched, the query is rejected — this stops a crafted expression from reading `users`, `settings`, `roles`, etc.
- The actual fetch then *also* runs inside a `ReadOnly: true` DB transaction as a second independent guard against any mutation.
- The exact same `%query%` mechanism powers every bulk action below (so "add to list", "blocklist", "delete", "unsubscribe" can all be scoped to "everyone matching this SQL expression", not just an explicit ID list) as well as CSV export filtering.

### Bulk operations
All exposed both as "operate on these IDs" and "operate on everyone matching this query":

| Action | Effect |
|---|---|
| **Add to list(s)** | Upserts `subscriber_lists` rows with the chosen status (`confirmed`/`unconfirmed`/`unsubscribed`), cross-joining selected subscribers × selected lists. |
| **Remove from list(s)** | Hard-deletes the `subscriber_lists` row entirely (full unlink, not a status change). |
| **Unsubscribe from list(s)** | Sets `subscriber_lists.status='unsubscribed'` (row is kept — preserves suppression history for compliance). |
| **Blocklist** | Sets subscriber `status='blocklisted'` **and**, in the same SQL statement, sets `subscriber_lists.status='unsubscribed'` for every list they're on. |
| **Delete** | Hard `DELETE FROM subscribers` (cascades to `subscriber_lists`, bounces, etc.). |
| **Delete orphans** | Removes subscribers belonging to zero lists (maintenance endpoint). |
| **Send opt-in e-mail** | `POST /api/subscribers/:id/optin` — manually re-trigger the double opt-in confirmation e-mail. |

### API surface (subscribers)
`GET/POST/PUT/PATCH/DELETE /api/subscribers[...]`, `PUT /api/subscribers/lists`, `PUT /api/subscribers/query/lists`, `PUT/POST /api/subscribers/{query,}/blocklist`, `POST /api/subscribers/query/delete`, `GET /api/subscribers/:id/export` (GDPR data export — profile + subscriptions + campaign views + link clicks, with private-list names redacted to "Private list"), `GET/DELETE /api/subscribers/:id/bounces`, `POST /api/public/subscription` (unauthenticated public signup).

---

## 3. Lists

**Files:** `models/lists.go`, `internal/core/lists.go`, `cmd/lists.go`.

| Field | Options | Meaning |
|---|---|---|
| `type` | `public` / `private` | Public lists appear on the public signup form; private lists are admin-only (hidden from self-service pages, shown as "Private list" in exports). |
| `optin` | `single` / `double` | Whether new subscribers must click a confirmation e-mail before receiving campaigns on that list. |
| `status` | `active` / `archived` | Archived lists are hidden from campaign/selector UI and public forms by default but remain queryable. |
| `tags` | string array | Free-form tagging for organizing lists. |

- Defaults on creation: `private` / `single` / `active` (safe-by-default).
- Subscriber counts are **not computed live**. A materialized view `mat_list_subscriber_stats` pre-aggregates counts **per list per subscription-status** (`confirmed`/`unconfirmed`/`unsubscribed`) plus a synthetic row for the grand total, refreshed on a debounced schedule — this is what makes the Lists page and dashboard fast even with millions of subscribers.
- Lists connect to campaigns via `campaign_lists`, which stores a **denormalized snapshot** of the list name (kept in sync on rename) — this deliberately lets a campaign still show which lists it was sent to even after a list is later deleted.
- API: `GET/POST/PUT/DELETE /api/lists[...]`, `GET /api/public/lists` (unauthenticated, minimal `{uuid,name}` for building custom subscribe forms — only returns `public`+`active` lists).

---

## 4. Bulk Subscriber Import

**Files:** `internal/subimporter/importer.go`, `cmd/import.go`.

Only **one import can run at a time** per instance (singleton `Importer`). Flow:

1. **Upload** — `POST /api/import/subscribers`, multipart form with a `params` JSON blob (`mode`: `subscribe`/`blocklist`, `delim`, `lists[]`, `overwrite`/`overwrite_user_info`/`overwrite_sub_status`) and a `file` (CSV, optionally zipped — only the **first** CSV in a zip is used; multi-file zips are unsupported by design). File is streamed to a temp file, not held fully in memory.
2. **Parsing** — a first pass counts newlines (for a progress-bar percentage), then re-parses via `encoding/csv`. The header row must contain an `email` column (mandatory) and optionally `name` and `attributes` (a JSON string per row).
3. **Per-row validation** — email length-capped, sanitized, lowercased; if `name` is blank, a display name is derived from the e-mail local-part (`john.doe@x.com` → "John Doe"); domain allow/blocklist rules (from Settings → Privacy) are applied, supporting wildcard subdomains (`*.example.com`); malformed `attributes` JSON doesn't reject the row, just skips setting attribs with a warning logged.
4. **Producer/consumer pipeline** — parsed rows go onto a 10,000-capacity buffered channel; a separate goroutine commits them to Postgres in batches of 10,000 rows per transaction, so a multi-million-row import doesn't hold one giant transaction open.
5. **Upsert SQL — two modes:**
   - **Subscribe mode**: `INSERT ... ON CONFLICT(email) DO UPDATE` where `overwrite_user_info` controls whether an *existing* subscriber's name/attribs get overwritten (false = "just add to list, don't touch their info"), and `overwrite_sub_status` controls whether an existing list-membership status gets overwritten on conflict.
   - **Blocklist mode**: upserts the subscriber as `status='blocklisted'` and force-unsubscribes them from every list they're on — doesn't require a target list at all.
6. **No opt-in e-mails fire from import** (see §2) — imported double opt-in subscribers land as `unconfirmed` silently.
7. **Progress / control** — `GET /api/import/subscribers` (status: `none`/`importing`/`stopping`/`finished`/`failed`, with `total`/`imported` counts), `GET /api/import/subscribers/logs` (live log text), `DELETE /api/import/subscribers` (stop mid-run — cleanly drains in-flight work rather than killing the transaction).
8. **Completion notification** — an admin e-mail (`import-status.html` template) reports Imported/Total when the job finishes or fails.

---

## 5. Campaigns

**Files:** `models/campaigns.go`, `internal/core/campaigns.go`, `cmd/campaigns.go`.

### Lifecycle / status state machine
```
draft ──(schedule, requires send_at)──▶ scheduled ──(scan picks it up at send_at)──▶ running
  ▲                                        │  ▲                                         │
  └───────────(unschedule)─────────────────┘  └──────────(resume)── paused ◀──(pause)────┤
                                                                                          │
                                                                     cancelled ◀──(cancel)─┘
                                                            (running exhausts subscribers)
                                                                          │
                                                                          ▼
                                                                       finished
```
Enforced transitions (`UpdateCampaignStatus`): `draft ← scheduled`; `scheduled ← draft|paused` (requires a valid `send_at`); `running ← paused|draft` (i.e. "send now" or "resume"); `paused ← running`; `cancelled ← running|paused`. `finished` is **never** set via the API — only the sending engine sets it once a running campaign naturally exhausts its subscriber list. A campaign's body/config can only be edited while `draft`, `paused`, or `scheduled`.

### Types
- **`regular`** — a normal campaign with author-written content.
- **`optin`** — a special campaign auto-generated to invite existing subscribers on double opt-in lists to confirm. Its body is synthesized from the `subscriber-optin-campaign.html` template plus an opt-in link; created from the Lists page as a shortcut to (re-)prompt confirmation en masse. **There is no A/B-testing/variant feature** in listmonk.

### Content types
`richtext` (WYSIWYG editor), `html` (raw HTML), `markdown` (server-converted to HTML via goldmark at send time and on demand), `plain` (plaintext-only), `visual` (drag-and-drop block builder; rendered HTML is stored in `body`, and the builder's own JSON block structure is separately preserved in `body_source` so it can be re-edited).

### Scheduling & throttling while running
- `send_at` + status `scheduled` → picked up by a periodic scanner once due.
- **Per-second rate limit**: `app.message_rate` (default 10) × `app.concurrency` (default 10 worker goroutines) messages/sec effectively — each worker sleeps 1s after sending its quota.
- **Sliding window limit** (optional, `app.message_sliding_window*`): a coarser cap, e.g. "10,000 messages per hour" independent of the per-second rate, to respect ESP hourly/daily quotas — the batch-fetch loop sleeps out the remainder of the window once the quota is hit.
- **Auto-pause on errors**: `app.max_send_errors` (default 1000) — once a running campaign's send-error count reaches this, it's automatically paused and an admin notification e-mail is sent ("Too many errors").
- **Batch size**: `app.batch_size` (default 1000) subscribers pulled from the DB per fetch cycle (~every 5s) — larger batches reduce DB round-trips at the cost of memory, important for multi-million-subscriber lists.

### Campaign ↔ list relationship
Many-to-many via `campaign_lists`. Access control: a user can act on a campaign if they hold blanket `campaigns:get_all`/`manage_all`, or if the campaign touches at least one list they have permission on.

### Template compilation pipeline (`Campaign.CompileTemplate`)
1. If the subject contains `{{ }}`, it's compiled separately as a **`text/template`** (not `html/template`, to avoid HTML-escaping subject text).
2. The chosen base **Template**'s body (see §6) is parsed as an `html/template` rooted at name `"base"`.
3. Markdown campaigns are converted to HTML first.
4. The campaign's own `body` is compiled as a child template named `"content"` and merged into the base template's tree — this is exactly how a template's `{{ template "content" . }}` placeholder gets the real campaign content injected.
5. `altbody` (plaintext multipart alternative) and any templated custom headers are compiled the same way.

### Template variables & functions available inside campaign body/subject/headers
| Expression | Effect |
|---|---|
| `{{ .Subscriber.Email }}`, `.Name`, `.FirstName`, `.LastName`, `.UUID`, `.Status`, `.Attribs.<key>`, `.CreatedAt`/`.UpdatedAt` | Per-recipient personalization. |
| `{{ .Campaign.UUID }}`, `.Name`, `.Subject`, `.FromEmail` | Campaign metadata. |
| `{{ TrackLink "https://..." }}` | Rewrites a URL into a tracked redirect (`/link/:linkUUID/:campUUID/:subUUID`); registers the destination in the DB on first use; no-ops if tracking is disabled. |
| `{{ TrackView }}` | Emits an invisible 1×1 tracking-pixel `<img>` (explicit `width="1" height="1" style="display:none;..."` for spam-filter friendliness). |
| `{{ UnsubscribeURL }}` / `?manage=true` | Per-subscriber, per-campaign unsubscribe / manage-preferences link. |
| `{{ OptinURL }}` | Double opt-in confirmation link. |
| `{{ MessageURL }}` | "View in browser" link. |
| `{{ ArchiveURL }}` / `{{ RootURL }}` | Public archive link / site root. |
| `{{ Date "2006-01-02" }}`, `{{ Safe "<b>raw html</b>" }}`, `{{ L }}` (i18n) | Utility functions. |
| Full **Sprig** function library (100+ string/date/math/list helpers) | `env`, `expandenv`, `getHostByName` are explicitly removed for security (templates can't read server env vars or trigger DNS lookups). |

When individual tracking is disabled (Settings → Privacy), `TrackLink`/`TrackView` still track aggregate counts but substitute a dummy all-zero UUID instead of the real subscriber UUID, so clicks/opens can't be attributed to a specific person.

### Send-test-email & Preview
- `POST /api/campaigns/:id/test` sends the campaign to arbitrary e-mail addresses through the **real send pipeline** (not a mock) — useful for verifying actual SMTP delivery/rendering before a full send.
- `GET/POST /api/campaigns/:id/preview` renders the campaign (optionally with unsaved in-form edits) using a dummy subscriber and a dummy campaign UUID specifically so preview hits don't pollute real open/click stats.

### Public archive
A campaign can optionally be published to a public, browsable archive (`archive=true`, custom `archive_slug`, optional separate `archive_template_id`, and `archive_meta` JSON used in place of `.Subscriber` data since there's no real recipient on an archive page). Routes: `GET /archive` (index), `/archive.xml` (RSS/Atom feed), `/archive/:id`, `/archive/latest`. Inline `data-embed` images are resolved to public media URLs instead of `cid:` references (a browser page can't resolve MIME content-IDs).

### Analytics
- Aggregate `views`, `clicks`, `bounces`, `sent`, `to_send` counters on every campaign.
- Time-series analytics: `GET /api/campaigns/analytics/:type` (`type` = `views`/`clicks`/`bounces`) returns per-day counts for charting over a date range.
- Per-link analytics: same endpoint with `type=links` returns click counts broken down by destination URL.
- Live send-rate: `GET /api/campaigns/running/stats` exposes a real-time messages/minute figure straight from the in-memory rate counter of a running campaign.

---

## 6. Templates

**Files:** `models/templates.go`, `cmd/templates.go`.

Three types:
- **`campaign`** — an HTML shell (header/footer/branding) that **must** contain the placeholder `{{ template "content" . }}` exactly once; this is where the actual campaign body gets slotted in.
- **`campaign_visual`** — companion type for the drag-and-drop visual builder.
- **`tx`** — transactional templates are **self-contained** (no placeholder needed) and, unlike campaign templates, carry their own fixed `subject` (which can itself be a Go template expression).

Exactly one campaign template can be flagged `is_default` at a time (enforced atomically in SQL — setting a new default automatically unsets the old one); the last remaining or the current default template cannot be deleted.

Template function availability differs by type: campaign/campaign_visual templates get the full tracking-aware function map (`TrackLink`, `TrackView`, `UnsubscribeURL`, etc.); `tx` templates only get the generic functions (`Date`, `Safe`, `L`, Sprig) since transactional sends have no subscription/tracking context.

**Built-in system templates** (`static/email-templates/*.html`, editable by copying `static/` and passing `--static-dir`):
`base.html` (campaign wrapper), `campaign-status.html` (admin notification on campaign start/pause/finish), `import-status.html` (admin notification on import completion), `subscriber-optin.html` (double opt-in request), `subscriber-optin-campaign.html` (body for `optin`-type campaigns), `subscriber-data.html` (GDPR data-export e-mail), `forgot-password.html` (admin password reset), `smtp-test.html` (used by the "Send test e-mail" SMTP settings button).

**Public-facing HTML pages** (`static/public/templates/*.html`): `index.html` (shared header/footer), `home.html`, `message.html` (generic success/failure), `optin.html`, `subscription.html`, `subscription-form.html`.

---

## 7. Transactional E-mail (Tx API)

**Files:** `cmd/tx.go`, `models/messages.go`. `POST /api/tx`, gated by the dedicated `tx:send` permission (intended for a scoped API-key user, not a full admin account).

Distinct from campaigns in every important way: no `campaigns` table row, no lifecycle, no list/opt-out gating (a blocklisted subscriber can still receive a password-reset e-mail), no tracking functions, no scheduling — a tx send is synchronous and fires immediately through a separate message queue (`msgQ`) that bypasses all campaign pipe/rate-limit/pause machinery.

**Subscriber resolution modes** (`subscriber_mode`):
| Mode | Behavior |
|---|---|
| `default` | Recipient **must** already exist as a subscriber (looked up by email or ID). Unknown ones are reported as errors. |
| `fallback` | Looks up by e-mail; if not found, still sends to that address using an ephemeral in-memory subscriber record (name/attribs empty). |
| `external` | Never touches the subscriber DB at all — sends to any given e-mail address outright. |

Payload: `template_id` (a `tx`-type template, cached in memory for zero-DB-hit rendering), `data` (arbitrary JSON exposed in the template as `{{ .Tx.Data.* }}`), optional `subject`/`from_email`/`headers`/`content_type`/`altbody`/`messenger` overrides, and file attachments via `multipart/form-data`. Multiple recipients in one call (`subscriber_ids`/`subscriber_emails` arrays) trigger one independently-rendered send per recipient. Use cases: password resets, order receipts, welcome e-mails, verification codes — anything triggered by application logic rather than a marketing send.

---

## 8. SMTP & the E-mail Sending Engine (deep dive)

This is the core of "how marketing e-mail is actually sent." Two layers cooperate: **the manager** (queueing/throttling/lifecycle, `internal/manager/`) and **the SMTP messenger** (actual wire-level delivery, `internal/messenger/email/email.go`, built on `github.com/knadh/smtppool/v2`).

### 8.1 SMTP server configuration
Configured entirely from the admin UI (Settings → SMTP), stored as a JSON array in the `settings` table — **multiple SMTP servers can be configured simultaneously**. Per server:

| Field | Purpose |
|---|---|
| `name` | Unique identifier; auto-prefixed `email-` so each enabled server also acts as its own selectable messenger (a campaign can target one specific SMTP server by name, or the pooled default `email`). |
| `host`, `port`, `hello_hostname` | Connection target and EHLO/HELO identity. |
| `auth_protocol` | `cram` (CRAM-MD5), `plain` (PLAIN), `login` (custom LOGIN auth), or `none`. |
| `username`, `password` | Credentials (password is masked in API responses; blank on save = "keep existing"). |
| `tls_type` | `none`, `STARTTLS`, or `TLS` (implicit SSL, e.g. port 465). |
| `tls_skip_verify` | Disable certificate verification (otherwise `ServerName` is pinned to `host`). |
| `max_conns` | Max concurrent connections in that server's pool. |
| `max_msg_retries` / `msg_retry_delay` | How many times, and how long to wait between, silent retries of a failed send using a different pooled connection before it's logged as a permanent failure. |
| `idle_timeout` | How long a pooled connection may sit idle before being closed. |
| `wait_timeout` | How long a send will wait for a free pooled connection before failing. |
| `email_headers` | Static custom headers (e.g. a fixed `Return-Path`) attached to every message sent via that server. |
| `from_addresses` | One or more e-mail addresses **or bare domains** this server should specifically handle (see routing below). |
| `enabled` | At least one enabled SMTP block is required to save settings. |

**"Send test e-mail"** (`POST /api/settings/smtp/test`) spins up a temporary single-connection pool from the in-progress (possibly unsaved) form values and sends the `smtp-test.html` template, surfacing the raw SMTP transcript/error back to the admin UI for debugging.

### 8.2 Connection pooling & round-robin / from-address routing
Every enabled SMTP server becomes a `smtppool.Pool` (a real connection pool, not one connection per message). Servers are indexed into `map[string][]*Server`:
- Every server is always registered under the global `""` key.
- Additionally, for each address/domain in that server's `from_addresses`, the server is added to that address's bucket.

**On every send:**
1. If the campaign/message's `From` address (or its domain) matches a bucket, that bucket becomes the candidate pool; otherwise the global pool (all servers) is used.
2. Within the candidate pool, one server is picked at **random** (`rand.Intn`) — this load-balances across every server mapped to that from-address (or across all servers globally with no mapping), so multiple SMTP servers configured for the same sending domain are effectively round-robined between sends.
3. Duplicate `from_addresses` across multiple SMTP blocks are explicitly supported and intentionally load-balance together.

This lets an operator, for example, spread a large newsletter across three separate SMTP relays (their own domain-warmed servers, or three different ESP accounts) purely by giving each server the same `from_addresses` entry — no per-campaign configuration needed.

### 8.3 Message construction & MIME details
For each recipient, `email.Push()`:
- Builds a `smtppool.Email{From, To, Subject, Attachments}`.
- Attaches the server's static `email_headers`, then the message's own headers (custom headers, campaign/subscriber UUID headers), letting per-message headers override per-server ones.
- Auto-generates a `Message-Id` header (`<24-random-chars>@<from-domain>`) if none was set.
- A `Return-Path` header, if present, is moved onto the SMTP **envelope sender** (not left as a visible header) — this is exactly the mechanism the bounce-mailbox feature relies on (routing bounces to a dedicated inbox different from the visible `From`).
- `Bcc`/`Cc` headers, if present, are similarly moved onto the SMTP envelope recipient list rather than sent as literal headers.
- Content is set based on `content_type`: `plain` → `em.Text`; everything else → `em.HTML`, with `AltBody` (if present) also set as `em.Text` for proper multipart/alternative MIME (so plain-text-only mail clients and spam filters see a text version too).
- **Attachments**: both regular file attachments (from Media, §12) and **inline embedded images** (`<img data-embed src="...">` tags, resolved before template compilation into `cid:`-referenced MIME inline parts with generated Content-IDs) are supported — the latter lets images render inside the e-mail without any external image request (works even with images blocked, avoids exposing a trackable external URL for the image itself).

### 8.4 Every outgoing campaign message carries these headers
Set by the manager's `worker()` before handing off to the messenger:
- `X-Listmonk-Campaign` (campaign UUID) and `X-Listmonk-Subscriber` (subscriber UUID) — used by bounce-webhook handlers and the POP3 bounce scanner to correlate a bounce back to the exact campaign/subscriber.
- If **Settings → Privacy → "Unsubscribe header"** is enabled: `List-Unsubscribe: <unsub-url>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` — implements RFC 8058 one-click unsubscribe, which major inbox providers (Gmail, Outlook, Yahoo) now require for bulk senders to avoid spam-folder placement.
- Any custom headers configured on the campaign itself (which can also be Go-templated per recipient).

### 8.5 Retries & failure handling
- **Connection-level retries**: `max_msg_retries` — a message that fails at send time is silently retried using a different pooled connection, up to that count. Only a message that still fails after all retries is logged as an error.
- **Campaign-level circuit breaker**: repeated failures increment an atomic per-campaign error counter; once `app.max_send_errors` is hit, the whole campaign auto-pauses (protects against burning through an entire subscriber list against a broken/rate-limited SMTP config) and the admin is e-mailed.
- Ports 25/465 being blocked by the hosting provider is a common real-world gotcha called out directly in the official docs.

### 8.6 Alternative delivery — the Postback/HTTP messenger
Besides SMTP, listmonk supports registering arbitrary **HTTP "messengers"** (Settings → Messengers): a webhook-style backend that receives a JSON POST per campaign send (`subject`, `body`, `content_type`, `recipients[]` with UUID/email/attribs, `campaign` metadata) and must respond `200 OK`. This is how community integrations bridge listmonk to SMS gateways, Firebase Cloud Messaging push notifications, Slack, etc. — the campaign send pipeline is channel-agnostic; SMTP e-mail is simply the default, built-in messenger. Supports optional HTTP Basic Auth to the receiving endpoint and the same `max_conns`/`timeout`/`max_msg_retries` connection tuning as SMTP.

---

## 9. The Sending Pipeline / Queue Architecture

**Files:** `internal/manager/manager.go`, `pipe.go`, `message.go`.

This explains *how* a campaign actually gets from "click Send" to "10,000 individual SMTP sends," precisely:

1. **`scanCampaigns()`** runs on a ticker (`ScanInterval`), polling the DB for campaigns that are `running` already or `scheduled` with `send_at <= now()`, along with each campaign's already-sent count (so a restart resumes exactly where it left off rather than re-sending).
2. For each due campaign, a **`pipe`** is created: it compiles the campaign's template (resolving inline images first), loads any media attachments, and is registered in an in-memory `pipes map[int]*pipe`.
3. The pipe pulls subscribers in batches (`NextSubscribers`, size = `app.batch_size`) from a query that returns only subscribers eligible for that campaign's lists (respecting per-list confirmed/unconfirmed/unsubscribed status and global subscriber status) **and not yet sent to** — the query itself is checkpointed by last-processed subscriber ID, which is how pausing/resuming/restarting mid-campaign works without duplicate sends.
4. For every subscriber in a batch, `NewCampaignMessage` renders the subject/body/altbody/headers (executing the compiled Go templates with that subscriber's data) and the resulting `CampaignMessage` is pushed onto a **buffered channel** (`campMsgQ`, sized `Concurrency × MessageRate × 2`).
5. A configurable number of **worker goroutines** (`app.concurrency`, default 10) continuously drain this channel. Each worker:
   - Self-throttles to `app.message_rate` messages/second (sleeps 1s after hitting quota, then resets).
   - Builds the final `models.Message` (headers, attachments, content), and calls the selected messenger's `Push()` (§8).
   - On success, increments the campaign's live rate-counter and sent-count.
   - On failure, logs it and calls the campaign's error-count-tracking (§8.5).
   - Uses a `sync.WaitGroup` per campaign to know when every in-flight message has been accounted for.
6. If the **sliding window** limiter is enabled (`app.message_sliding_window*`), the batch-fetch loop itself (not the workers) additionally sleeps once the configured message-count-per-duration is exceeded, on top of the per-second rate — this is for satisfying ESP-side hourly/daily caps that a per-second limit alone can't express.
7. **Pause/Cancel**: setting a campaign's status to `paused`/`cancelled` via the API immediately flags its in-memory pipe as `stopped`; already-queued-but-not-yet-sent messages in the channel are drained and silently ignored rather than sent, and no new subscriber batches are fetched.
8. **Completion**: once a pipe's wait-group empties (no more subscribers, or stopped), `cleanup()` writes the final sent-count to the DB, and — if the campaign wasn't manually stopped and wasn't auto-paused for errors — flips status to `finished`, then e-mails an admin notification either way (finished, paused-for-errors, or manually stopped/cancelled) via the `campaign-status.html` template.

**Why this design matters for "marketing email sent properly":** the batch+queue+worker+rate-limit stack together mean listmonk can safely blast a list of millions without either (a) exhausting server memory (subscribers are streamed in bounded batches, not loaded all at once), (b) getting rate-limited/blacklisted by the SMTP provider (per-second and per-window throttles are both configurable to match the ESP's stated limits), or (c) losing track of progress on a crash/restart (checkpointed by last-subscriber-ID, resumable).

---

## 10. Bounce Handling

**Files:** `internal/bounce/bounce.go`, `internal/bounce/mailbox/pop.go`, `internal/bounce/webhooks/*.go`.

### Architecture
A `bounce.Manager` owns an internal buffered queue; both the POP3 mailbox scanner and every webhook handler push `models.Bounce{Type, Source, Email/SubscriberUUID, CampaignUUID, Meta}` onto it, decoupled from a background goroutine that actually writes to the DB — so an ESP's webhook POST returns fast without waiting on a DB transaction.

### The threshold/action algorithm (exact logic, one atomic SQL statement)
Bounce type (`hard` / `soft` / `complaint`) is counted **independently per subscriber per type**. Default configuration:

| Type | Default count | Default action |
|---|---|---|
| `soft` | 2 | `none` |
| `hard` | 1 | `blocklist` |
| `complaint` | 1 | `blocklist` |

So out of the box, **a single hard bounce or spam complaint immediately blocklists the subscriber** (and cascades to unsubscribe them from every list), while soft bounces are merely counted and, by default, take no action until/unless the admin changes the threshold. Available actions per type: `none`, `blocklist`, `unsubscribe`, `delete`. Once the threshold is reached and an action fires, the SQL guards against re-triggering (an already-blocklisted subscriber isn't re-processed) and further bounces for that subscriber+type stop being recorded at all (caps table growth).

### Ingestion source 1 — POP3 bounce mailbox
A background goroutine polls a configured POP3 mailbox (default every 15 minutes), fetches up to 1000 messages per pass, and for each:
- Extracts listmonk's own `X-Listmonk-Campaign`/`X-Listmonk-Subscriber` headers (with regex fallback if they got mangled inside a nested DSN report part).
- **Classifies hard vs. soft** by first looking for an SMTP enhanced status code (`5.x.x` → hard, `4.x.x` → soft) in the message body; if none is found, falls back to keyword matching (`"mailbox not found"`, `"user unknown"`, `"does not exist"`, `"no such user"`, etc. → hard); if nothing matches, **defaults to soft** (the safer assumption).
- Deletes every scanned message from the mailbox after processing, regardless of match outcome.
- Setup requires either the campaign's `From` address itself to have a bounce mailbox behind it, or configuring the address as a `Return-Path` custom SMTP header so bounces route to a dedicated inbox instead.

(Note: only POP3 is actually implemented; an IMAP `folder` config field exists in the settings schema but is not wired to any client.)

### Ingestion source 2 — ESP webhooks
`POST /webhooks/service/:service`, individually toggleable per provider, each with its own authentication and payload parsing:

| Provider | Auth | Notes |
|---|---|---|
| **Amazon SES** (via SNS) | SNS message **signature verification** (fetches & validates the signing X.509 cert against a strict AWS-domain regex to prevent spoofing) | Also auto-completes the SNS subscription handshake. `Permanent` → hard, `Transient` → soft (upgraded to hard if the SMTP status is `5.4.4`), `Complaint` → complaint. |
| **Azure Communication Services** | Shared secret (query param or header, constant-time compare) | Handles the Event Grid subscription-validation handshake automatically. Status/text heuristically mapped to hard/soft/complaint. |
| **SendGrid** | ECDSA signature over `timestamp+body` | Batched event array; only `event=="bounce"` entries processed; classification-based hard/soft mapping. |
| **Postmark** | HTTP Basic Auth | `Bounce`/`SpamComplaint` record types; explicit hard/soft/complaint mapping table. |
| **Forward Email** | HMAC-SHA256 signature | Category-based hard/soft mapping. |
| **Lettermint** | Stripe-style `t=...,v1=...` HMAC signature with a 300-second replay-window check | Event-name-based mapping. |
| **Generic/native** | none (internal integration) | Accepts listmonk's own `models.Bounce` JSON shape directly, e.g. for a custom script reading logs. |

Every handler stores the full original raw payload verbatim as `meta` for audit/debugging, and lowercases the recipient e-mail before matching.

### Manual bounce management
`GET/DELETE /api/bounces[...]` (paginated, filterable by campaign/source), a bulk "blocklist everyone who has ever bounced, of any type/count" admin action, and per-subscriber bounce-history clearing (e.g. after manually confirming an address is valid again).

---

## 11. Tracking & Analytics (opens, clicks)

Implemented via the `TrackView`/`TrackLink` template functions (§5):
- **Open tracking**: a 1×1 invisible PNG served at `GET /campaign/:campUUID/:subUUID/px.png`; hitting it records a `campaign_views` row (unless global tracking or individual tracking is disabled, or the request is from a preview render).
- **Click tracking**: every wrapped link redirects through `GET /link/:linkUUID/:campUUID/:subUUID`, which records a `link_clicks` row and then 307-redirects to the real destination — this doubles as URL-shortening for long tracked links.
- Both can be disabled entirely (Settings → Privacy → "Disable tracking") or run **anonymously** (Settings → Privacy → "Individual tracking" off — aggregate counts still increment, but the specific subscriber isn't recorded), for GDPR-conscious deployments.
- Aggregated into per-campaign `views`/`clicks`/`bounces` counters, time-series analytics by day, and per-link click breakdowns (see §5 Analytics).

---

## 12. Media / Uploads

**Files:** `internal/media/`, `cmd/media.go`.

Two pluggable storage backends, chosen in Settings → Media:
- **Filesystem**: writes to a configured local directory, served back at a configured URL prefix.
- **S3**: supports explicit access/secret keys or falls back to IAM role credentials; supports public buckets (`ACL: public-read`) or private buckets served via time-limited **presigned URLs** (default/max validity ~7 days); listmonk can also reverse-proxy S3 objects itself if the bucket has no public URL.

On upload: extension is checked against an admin-configured allow-list (or `*` for any); raster images (gif/png/jpg) get a server-generated 250px-wide thumbnail; SVGs don't get a separate raster thumbnail. Failed uploads roll back (best-effort delete of any partially-written files).

**Two ways media is used in campaigns:**
1. **Regular attachment** — selected media IDs are loaded and sent as normal MIME attachments.
2. **Inline embedding** — any `<img data-embed src="filename.jpg">` in the campaign or template HTML is automatically resolved before sending: the file is looked up, given a `Content-ID`, embedded as an inline MIME part, and the `src` is rewritten to `cid:<id>` — meaning campaign images can be sent as part of the e-mail itself rather than loaded from an external URL (better privacy, works with images blocked, avoids a slow/broken external image host tanking deliverability perception).

---

## 13. Public-Facing Pages

**File:** `cmd/public.go`.

| Route | Purpose |
|---|---|
| `GET/POST /subscription/form` | Public signup page listing all public/active lists; honeypot field + optional CAPTCHA anti-bot protection. |
| `POST /api/public/subscription` | JSON/form API equivalent, for embedding a custom signup form on an external site. |
| `GET/POST /subscription/:campUUID/:subUUID` | Unsubscribe / "manage my subscriptions" page (linked from every campaign footer). Supports a quick one-click unsubscribe-from-this-campaign's-lists, or, if enabled, full checkbox-based preference management across all non-private lists. |
| `GET/POST /subscription/optin/:subUUID` | Double opt-in confirmation page — requires an explicit click (not just a GET, to avoid e-mail security scanners silently auto-confirming) unless the interstitial is disabled in settings. |
| `POST /subscription/export/:subUUID` | Self-service GDPR data export — e-mails the subscriber their own profile/subscriptions/view/click history as JSON. |
| `POST /subscription/wipe/:subUUID` | Self-service GDPR "forget me" — hard-deletes the subscriber record. |
| `GET /campaign/:campUUID/:subUUID` | "View in browser" — live re-render of exactly what that subscriber's e-mail looked like. |
| `GET /archive`, `/archive.xml`, `/archive/:id`, `/archive/latest` | Public campaign archive (see §5). |

All of these respect global feature toggles (Settings → Privacy/General: `allow_blocklist`, `allow_export`, `allow_wipe`, `allow_preferences`, `enable_public_subscription_page`, `enable_public_archive`).

**CAPTCHA** (only on the public signup form): either **hCaptcha** (third-party challenge, verified server-side against `hcaptcha.com/siteverify`) or **Altcha** (self-hosted proof-of-work challenge, no third-party call, with server-side replay protection) — mutually exclusive, Altcha taking priority if both are enabled.

---

## 14. Auth, Users & Roles

**Files:** `internal/auth/`, `cmd/auth.go`, `cmd/users.go`, `cmd/roles.go`.

### Authentication methods
1. **Username/password** — bcrypt-hashed (Postgres `pgcrypto`), enforced 8–2000 char minimum length (no complexity rules), with a constant ~100ms response-time floor on login to resist username enumeration/timing attacks.
2. **OIDC / SSO** — standards-based OpenID Connect against any provider (Google, Microsoft, Auth0, generic); supports auto-creating users on first login with a configurable default role.
3. **API tokens** — a user of `type=api` gets a random 48-byte token; only its SHA-256 hash is stored; the plaintext is shown exactly once at creation. Verified via an in-memory cache (refreshed on every user/role mutation) so API auth never costs a DB round-trip per request. Sent as `Authorization: token <key>:<token>`.
4. **2FA (TOTP)** — optional per-user; on login, a short-lived (5 min) intermediate token gates entry to a second `/admin/login/twofa` step requiring a valid 6-digit code.

Sessions are Postgres-backed, `HttpOnly` cookies, 7-day max age, pruned every 12h. A password reset invalidates all of that user's existing sessions; a self-service password change invalidates all sessions *except* the current one.

### Roles & granular permissions (v4.0+)
Two independent role types:
- **User roles** — a flat set of permission strings covering: lists (get/manage all), subscribers (get/get_all/manage/import/**sql_query**), transactional send, campaigns (get/get_all/get_analytics/manage/manage_all/**send** — note `send` is required independently of `manage` to actually start/pause/cancel a campaign), bounces (get/manage/webhook-post), media (get/manage), templates (get/manage), users (get/manage), roles (get/manage), settings (get/manage/maintain).
- **List roles** — scope a user to specific list IDs with `get`/`manage` granularity, letting an org give a marketer access to only their own team's lists without blanket list permissions.
- **Super Admin** (role ID 1) bypasses every permission check and cannot be edited/deleted — created automatically during first-run setup.
- The `subscribers:sql_query` permission is called out with an explicit warning (in-app and in docs) since it grants read access across the whole DB schema, superseding per-list restrictions — official guidance recommends creating a locked-down Postgres role for it in high-trust-boundary deployments.

---

## 15. Settings Reference (complete)

Stored as key→JSON rows in the DB (editable live from the UI, no restart needed for most keys — SMTP/manager-affecting changes trigger either an immediate self-restart via SIGHUP, or, if a campaign is actively sending, a "restart needed" banner deferring the reload until it's safe).

| Group | Keys (highlights) |
|---|---|
| **General** (`app.*`) | site name, root URL, logo/favicon, default From address, admin notification e-mails, UI language, public subscription/archive toggles, slow-query caching + cron schedule. |
| **Performance** (`app.*`) | `batch_size` (1000), `concurrency` (10), `message_rate` (10/sec/worker), `max_send_errors` (1000), sliding-window enable + duration + rate. |
| **SMTP** (`smtp[]`) | Full per-server config — see §8.1. |
| **Messengers** (`messengers[]`) | Custom HTTP postback backends — see §8.6. |
| **Bounces** (`bounce.*`) | Enable processing, enable webhooks, per-type count/action map, per-ESP enable+credentials (SES/Azure/SendGrid/Postmark/ForwardEmail/Lettermint), mailbox config (host/port/auth/TLS/scan interval). |
| **Privacy** (`privacy.*`) | Individual tracking, disable tracking, unsubscribe header, allow blocklist/export/wipe/preferences, exportable data categories, record opt-in IP, domain allow/block lists. |
| **Security** (`security.*`) | CAPTCHA provider config (Altcha/hCaptcha), OIDC provider config, trusted redirect URLs. |
| **Uploads** (`upload.*`) | Provider (filesystem/S3), allowed extensions, filesystem path/URI, full S3 credentials/bucket/expiry config. |
| **Maintenance** (`maintenance.db.*`) | Scheduled `VACUUM`, cron interval. |
| **Appearance** (`appearance.*`) | Custom CSS/JS for the admin UI and for public pages, separately. |

---

## 16. Internal Events, Notifications & Webhooks

- **`internal/events`** — a lightweight in-process pub/sub bus (not persisted) that mirrors any log line containing "error" out to subscribed channels — backs a live error-log stream in the admin UI, not a general external-webhook system.
- **`internal/notifs`** — the system e-mail engine. Sends admin-facing notifications (campaign started/paused/finished, import job finished) and subscriber-facing system e-mails (opt-in confirmation, GDPR data export, admin password reset). Each template can embed its own subject override via a special `<title data-i18n>` tag, supporting localization per notification.
- **Outbound webhooks** — the only genuine "call an external HTTP endpoint" integration is the **Postback messenger** (§8.6): any campaign or transactional send can be routed to an arbitrary HTTP endpoint instead of (or alongside, via multiple messengers) SMTP.
- **Inbound webhooks** — limited to the bounce-processing webhooks (§10) from supported ESPs; there is no general "notify my server on unsubscribe/open/click" callback system.

---

## 17. Internationalization (i18n)

`internal/i18n/` implements a small translation engine intentionally compatible with `vue-i18n` string semantics, so **the same JSON language files** (`i18n/*.json`, ~37 languages) drive both server-rendered strings (login page, system e-mails, error messages) and the Vue admin UI. Supports simple lookup, `{param}` interpolation, and `singular | plural` pluralization. Active language is set per-installation via `app.lang`.

---

## 18. Full API Route Map

**Admin/private (session or API-key auth):**
```
/api/campaigns[...]          CRUD, /test, /preview, /preview/archive, /status, /archive, /content, /text, /analytics/:type, /running/stats
/api/subscribers[...]        CRUD, /export, /bounces, /optin, /lists, /query/lists, /blocklist, /query/blocklist, /query/delete
/api/lists[...]              CRUD
/api/templates[...]          CRUD, /preview, /default
/api/tx                      Transactional send
/api/media[...]              CRUD
/api/bounces[...]            list/query/delete, /blocklist
/api/import/subscribers[...] upload / status / logs / stop
/api/settings[...]           get/update, /smtp/test
/api/users[...]              CRUD, /twofa, /twofa/totp
/api/roles/*                 user roles & list roles CRUD
/api/dashboard/{charts,counts}
/api/maintenance/*           analytics export/cleanup, unconfirmed-subscription cleanup
/api/logs, /api/events, /api/health, /api/about, /api/config, /api/profile, /api/logout
/webhooks/bounce             native bounce webhook
```

**Public (unauthenticated):**
```
/subscription/form, /subscription/:campUUID/:subUUID, /subscription/optin/:subUUID,
/subscription/export/:subUUID, /subscription/wipe/:subUUID
/campaign/:campUUID/:subUUID (view in browser), /campaign/:campUUID/:subUUID/px.png (open tracking)
/link/:linkUUID/:campUUID/:subUUID (click tracking + redirect)
/archive, /archive.xml, /archive/:id, /archive/latest
/api/public/lists, /api/public/subscription, /api/public/archive, /api/public/captcha/altcha
/webhooks/service/:service   SES / Azure / SendGrid / Postmark / ForwardEmail / Lettermint bounce webhooks
```

---

## 19. Admin UI (Vue frontend) Map

`frontend/src/views/`, organized by the same feature areas: **Campaigns** (list, editor, per-campaign analytics), **Subscribers** (list/search, form, bulk actions, import), **Lists** (list, form), **Templates** (list, editor), **Media** (library/uploader), **Bounces** (log/review), **Users & Roles** (users, profile/2FA, user roles, list roles), **Settings** (general, SMTP, messengers, bounces, media, performance, privacy, security, appearance — one sub-tab per settings group in §15), and system pages: **Dashboard** (stats/charts), **Logs** (live app log viewer), **Maintenance** (DB tools), **Forms** (embeddable public signup-form code generator), **About**.

---

## 20. Performance & Maintenance Notes

- Designed to handle **millions of subscribers** on a single Postgres instance with no external queue/cache.
- At very large scale, live `COUNT(*)`-style dashboard/list-page stats can get slow; **Settings → Performance → "Cache slow database queries"** switches these to a periodically-refreshed materialized cache (cron-scheduled, default 3 AM daily) instead of computing on every page load.
- Regular Postgres `VACUUM ANALYZE` is recommended for large installs and can be scheduled from Settings → Maintenance.
- `batch_size` is the main lever for import/campaign-send throughput vs. memory trade-off on huge lists.
