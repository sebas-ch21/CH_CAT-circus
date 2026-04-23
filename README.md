# Charlie Admissions — Capacity Circus & Dispatch

Real-time workforce management and dispatch for clinical intake. An admin
plans capacity, a manager hosts Biopsychosocial (BPS) slots, and
Individual Contributors (ICs) pick up overflow assignments live.

> **Handoff note.** This README is written so a new engineer — or an AI
> agent reviewing the codebase — can build an accurate mental model in
> one pass. Start with [What ships today](#what-ships-today) for the
> product surface, then [Architecture](#architecture) for the code layout,
> then [Integrations: mock-first, live-ready](#integrations-mock-first-live-ready)
> for the new work. Production go-live steps live in
> [docs/GO_LIVE.md](docs/GO_LIVE.md).

---

## Table of contents

1. [What ships today](#what-ships-today)
2. [Tech stack](#tech-stack)
3. [Architecture](#architecture)
4. [Data model](#data-model)
5. [Authentication (three coexisting paths)](#authentication-three-coexisting-paths)
6. [Dispatch flow](#dispatch-flow)
7. [Integrations: mock-first, live-ready](#integrations-mock-first-live-ready)
8. [Feature flags](#feature-flags)
9. [Local development](#local-development)
10. [Testing](#testing)
11. [Deployment checklist](#deployment-checklist)
12. [Next steps for the engineer finishing the integrations](#next-steps-for-the-engineer-finishing-the-integrations)
13. [Nuances and gotchas](#nuances-and-gotchas)
14. [Repository map](#repository-map)

---

## What ships today

| Surface | What it does |
|---|---|
| **Admin Panel** (`/admin`) | Capacity planning (Calc % math), daily plan publishing, roster CRUD, bulk CSV upload with **IC → Manager → Admin hierarchy**, PIN management, slot inspection. |
| **Manager Center** (`/manager`) | Team schedule input, open-slot dispatch console, scheduled matches table, per-manager statistics, **Zoom link modal** (manual paste + optional programmatic generate). |
| **IC Dashboard** (`/ic`) | Personal queue view, availability toggle, confirm/release assignments. |
| **Login** (`/`) | Magic-link OTP, legacy PIN (break-glass for Admin/Manager), optional **Okta SSO** button. |

### Cross-cutting capabilities

- **Real-time dispatch** via Supabase Realtime subscriptions — Available
  ICs and Open Slots match live with no polling.
- **Background sweepers** (SQL RPCs) clear stale queue rows (25 min) and
  unconfirmed assignments (5 min) on every tick.
- **Role-based access** via `app_role` enum (`ADMIN | MANAGER | IC`)
  with the new hierarchy columns `manager_id` and `admin_id`.
- **Integration audit log** — every calendar/zoom/okta/scim write goes
  through `integration_audit_log` so operators get one-stop observability.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| UI | React 19 + Vite 8 | JSX only, no TypeScript on the client. |
| Styling | Tailwind CSS + lucide-react icons | No CSS-in-JS. |
| Client data | `@supabase/supabase-js` v2 | Supabase Realtime for live queues. |
| Server data | Supabase Postgres | RLS on every table; permissive policies today (see [Nuances](#nuances-and-gotchas)). |
| Server logic | Supabase **Edge Functions** (Deno + TypeScript) | Everything that needs a secret lives here — never in the client. |
| Scheduling | `pg_cron` + `net.http_post` | Calendar sync loop, queue sweepers. |
| Testing | Vitest + React Testing Library + jsdom | Unit + adapter contract tests. |
| Forms / CSV | `papaparse`, `react-hot-toast`, `react-router-dom` v7 | — |

---

## Architecture

```
React (Vite)                     Supabase (Postgres + Edge Fns)
─────────────                    ──────────────────────────────
src/pages            ──────►    app_settings (feature flags, PINs, maps)
src/components                  profiles (hierarchy, zoom_user_id)
src/hooks            ──────►    bps_slots, ic_queue, assignments …
src/context (Auth)              calendar_connections / calendar_open_slots
src/lib/integrations ◄─────►    zoom_request_log, zoom_usage, zoom_rooms
  └── adapters (mock | live)    scim_subjects, auth_audit_log
                                integration_audit_log

                    Edge Functions (Deno):
                      auth-jit-sync        (Okta → profile row)
                      scim-users           (SCIM 2.0 /Users)
                      sync-calendars       (pg_cron-triggered)
                      zoom-create-meeting  (idempotent)
```

### Folder layout

| Path | Role |
|---|---|
| `src/pages` | Top-level route wrappers (Admin, Manager, IC, Login). |
| `src/components` | Leaf UI (WaitingQueue, OpenSlots, CSVUploadZone, ZoomLinkModal, …). Single-responsibility and UI-only. |
| `src/hooks` | Business logic + Supabase data-fetching (`useDispatchData`, `useCapacityPlanner`, `useManagerStats`). UI components are skinny, hooks do the work. |
| `src/context/AuthContext.jsx` | Auth bootstrap, roster verification, Okta JIT call, PIN login. |
| `src/lib/supabase.js` | Supabase client singleton. |
| `src/lib/integrations/` | **New.** Adapter factory, feature flags, audit logging. |
| `src/lib/{auth,calendar,zoom}/` | **New.** Per-integration mock + live adapters with identical method signatures. |
| `src/__tests__/` | Vitest specs including `integrations.test.js` adapter contract tests. |
| `supabase/migrations/` | Append-only DDL + seed. Newest ones (`20260423120002…6`) ship the hierarchy + all integration scaffolding. |
| `supabase/functions/` | **New.** Deno edge functions + `_shared` helpers (service-role client, CORS, audit). |
| `docs/GO_LIVE.md` | Last-mile runbook per integration. |

### Adapter pattern (the core mental model for new work)

Every external integration ships **two objects with identical shape**:

```js
// src/lib/zoom/mockAdapter.js            src/lib/zoom/liveAdapter.js
export const zoomMockAdapter = {...}    export const zoomLiveAdapter = {...}
```

`src/lib/integrations/index.js` decides which one the UI gets at runtime:

```js
VITE_ZOOM_MODE=mock   → zoomMockAdapter
VITE_ZOOM_MODE=live   → zoomLiveAdapter
```

Consumer code never branches on the mode:

```js
import { getZoomAdapter } from '../lib/integrations';
const { joinUrl } = await getZoomAdapter().generateMeetingLink({ slot });
```

This is the single most important idea in the codebase after dispatch
state machines — **preserve parity** between mock and live, or the UI
will silently misbehave when an operator flips modes. The contract is
pinned by `src/__tests__/integrations.test.js`.

---

## Data model

Core tables (existing + new). Full DDL lives under `supabase/migrations/`.

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | Everyone with access. | `id, email, role (app_role), tier_rank, current_status, manager_id, admin_id, zoom_user_id` |
| `app_settings` | KV config the UI reads/writes. | `setting_key, setting_value` — includes `features`, `admin_pin`, `manager_pin`, `okta_group_role_map`, `calendar_flag_token`, `zoom_mode`. |
| `bps_slots` | Open & assigned overflow slots. | `patient_identifier, host_manager, start_time, status, zoom_link, zoom_source, zoom_meeting_id, zoom_host_id` |
| `ic_queue` / `assignments` | Live dispatch state. | — |
| `manager_schedules` / `daily_capacity_plans` | Admin capacity planner. | — |
| `calendar_connections` | Per-user OAuth state. | `provider, access_token_ciphertext, refresh_token_ciphertext, sync_cursor, last_sync_at` |
| `calendar_open_slots` | Derived from events matching the flag. | `connection_id, profile_id, start_time, end_time, source_event_id, title_flag` |
| `zoom_usage` | Per-host daily meeting counter for quota. | `zoom_user_id, day_bucket, meetings_created` |
| `zoom_rooms` | Zoom Room inventory for Rooms-mode. | `zoom_room_id, active, last_booked_at` |
| `zoom_request_log` | Idempotency log for meeting creation. | `client_request_id (unique), status, response` |
| `scim_subjects` | Okta SCIM ↔ profile binding. | `external_id (unique), profile_id, active` |
| `auth_audit_log` | Per-login JIT audit. | `email, resolved_role, okta_groups, event, claims` |
| `integration_audit_log` | Shared observability sink. | `source, action, severity, correlation_id, actor_profile, payload` |

### Hierarchy invariants (enforced by trigger)

The `fn_validate_profile_hierarchy` BEFORE INSERT/UPDATE trigger enforces
rules that CHECK constraints cannot (they reference another row):

- `ADMIN` → both `manager_id` and `admin_id` MUST be `NULL`.
- `MANAGER` → `manager_id` MUST be `NULL`; `admin_id` optional, must
  point at an `ADMIN` when set.
- `IC` → `admin_id` MUST be `NULL`; `manager_id` optional for backfill,
  must point at a `MANAGER` when set.
- Nobody can be their own manager or admin.

The Admin Panel pre-clears stale pointers on role changes via
`buildRoleChangeUpdate()` so the trigger never rejects a legitimate UX.
The bulk CSV path uses `fn_bulk_assign_hierarchy(jsonb)` which returns
`{success_count, failures[]}` per row so the UI can surface partial
outcomes.

---

## Authentication (three coexisting paths)

All three paths land on a single `profiles` row — downstream code never
branches on how the user authenticated.

1. **Supabase Magic Link** — primary path. `loginWithMagicLink(email)` in
   `AuthContext` → Supabase sends an OTP → user returns with a session.
2. **Local PIN** — break-glass for `ADMIN` and `MANAGER`. PIN hashes live
   in `app_settings` (`admin_pin` / `manager_pin`). Used by QA and for
   recovery scenarios.
3. **Okta OIDC SSO** *(optional, feature-flagged)* — `loginWithOkta()`
   dispatches to the Okta adapter, which calls
   `supabase.auth.signInWithSSO({ domain })`. On the first return trip,
   `AuthContext.verifyAgainstRoster` calls the `auth-jit-sync` edge
   function; if Okta groups map to a role, a `profiles` row is created.
   Users whose Okta groups match nothing are signed out — roster is the
   source of truth.

Okta **deprovisioning** arrives over SCIM (`scim-users` edge function):
`PATCH {active: false}` flips `scim_subjects.active` and sets the
profile's `current_status = 'BUSY'`.

---

## Dispatch flow

(Unchanged by this release — documented here for completeness.)

1. Admin publishes a capacity plan → rows inserted into `bps_slots` with
   `status = OPEN`.
2. Managers see the open slots on `/manager`, can attach Zoom links
   (manual or generated — see [Zoom](#zoom-programmatic-meetings--zoom-rooms)),
   and dispatch.
3. ICs toggle **Available** on `/ic` → a row in `ic_queue`.
4. A dispatch event matches the next-available IC to an open slot → row
   in `assignments`; IC must confirm within 5 min or the sweeper
   releases it.
5. Queue sweeper clears `ic_queue` rows older than 25 min.

---

## Integrations: mock-first, live-ready

Every integration ships in **mock mode** so the app is always deployable.
Flipping any of them live is a series of small, reversible steps
documented in [docs/GO_LIVE.md](docs/GO_LIVE.md).

### Calendar (Google first, Outlook stubbed)

- **Goal**: detect manager/IC calendar events titled with a flag (default
  `[BPS-OPEN]`) and expose them as bookable open slots — decoupled from
  `bps_slots` so dispatch logic can evolve independently.
- **Client**: `src/lib/calendar/googleAdapter.js` (live) or `mockAdapter.js`
  (fake slots 30 min apart). Both expose `isConfigured / connect /
  listOpenSlots / triggerSync`.
- **Server**: `supabase/functions/sync-calendars` pulls events per
  connection, filters by `app_settings.calendar_flag_token`, upserts into
  `calendar_open_slots`. Google fetch is **stubbed** (returns `[]`) until
  OAuth + token decrypt are wired in — the function is deployable today
  and exercises every DB path.
- **Schedule**: `pg_cron` call commented at the bottom of
  `20260423120005_calendar_sync.sql` — uncomment and re-run on go-live.

### Zoom (programmatic meetings + Zoom Rooms)

- **Goal**: replace manual Zoom paste with one-click generation, with
  per-host daily quota awareness and automatic fallback to Zoom Rooms.
- **Client**: `ZoomLinkModal.jsx` renders a **Generate via Zoom** button
  gated by `features.zoom_meeting_api`. The manual paste input stays
  as a permanent fallback so failures degrade gracefully.
- **Server**: `supabase/functions/zoom-create-meeting` handles:
  - **Idempotency** via `zoom_request_log` (same `client_request_id`
    returns the original response).
  - **Mode selection** (`zoom_mode ∈ user | rooms | auto`).
  - **Quota**: `isUnderDailyCap` + `bumpUsage` against `zoom_usage`.
  - **Host resolution**: `bps_slots.host_manager` email →
    `profiles.zoom_user_id`.
  - **Rooms fallback**: picks least-recently-booked active `zoom_rooms`
    row.
  - **Network**: token mint + `POST /users/{id}/meetings` are **stubbed**;
    the server rejects with `zoom_credentials_missing` until secrets are
    set. Everything around the stub is production-wired.

### Okta SSO + SCIM

- **Goal**: let IT manage users centrally; on first login create the
  `profiles` row automatically; handle deactivations through SCIM.
- **Client**: `oktaLiveAdapter` calls `supabase.auth.signInWithSSO`;
  `AuthContext.tryOktaJitProvision` invokes `auth-jit-sync` when a user
  with no profile row shows up.
- **Server / JIT**: `auth-jit-sync` verifies the Supabase JWT, looks up
  `app_settings.okta_group_role_map`, resolves role with `ADMIN > MANAGER > IC`
  priority, upserts `profiles`, writes `auth_audit_log`.
- **Server / SCIM**: `scim-users` implements list / get / create / patch
  (`active` replace) / delete (soft). Bearer token compared in
  constant-time against `OKTA_SCIM_BEARER_TOKEN`.

### IC → Manager → Admin hierarchy *(already live)*

- `profiles.manager_id` + `profiles.admin_id` + trigger-enforced
  invariants. Admin Panel has inline role + hierarchy pickers, a
  CSV-upload path with per-row hierarchy columns, and a new-user modal
  with conditional dropdowns (showManager if `role=IC`, showAdmin if
  `role=MANAGER`). Bulk RPC returns structured failures so the UI can
  explain *why* a row did not apply.

---

## Feature flags

Stored in `app_settings.features` (JSON), read client-side by
`src/lib/integrations/featureFlags.js`.

**Precedence (highest first):**

1. Env override: `VITE_FORCE_FEATURE_<NAME> = "true" | "false"`.
2. `app_settings.features` row from Supabase.
3. Safe default: **false** — never render integration UI by accident.

**Flag names (frozen so typos blow up at import time):**

```js
FEATURES.CALENDAR_SYNC       // 'calendar_sync'
FEATURES.ZOOM_MEETING_API    // 'zoom_meeting_api'
FEATURES.OKTA_SSO            // 'okta_sso'
FEATURES.OKTA_SCIM           // 'okta_scim'
```

**How to use:**

```jsx
// React component
const enabled = useFeatureFlag(FEATURES.ZOOM_MEETING_API);

// Outside React (route guard, AuthContext)
if (await isFeatureEnabledAsync(FEATURES.OKTA_SSO)) { ... }

// Cheap synchronous check (returns false if cache is cold, then warms)
if (isFeatureEnabled(FEATURES.CALENDAR_SYNC)) { ... }
```

Flags cache in-module for the SPA session; admins toggling flags should
hard-refresh to observe.

---

## Local development

```bash
git clone https://github.com/your-org/ch_cat-circus.git
cd ch_cat-circus
npm install
cp .env.example .env             # fill in Supabase URL + anon key
npm run dev                      # Vite dev server on :5173
```

All integrations default to **mock mode** (`VITE_*_MODE=mock`) so the app
boots without any calendar/Zoom/Okta config. See `.env.example` for every
variable the code reads.

---

## Testing

```bash
npm test                 # one-shot (vitest run)
```

| Suite | Covers |
|---|---|
| `src/__tests__/AdminPanel.test.jsx` | Admin page render + smoke. |
| `src/__tests__/ManagerCenter.test.jsx` | Manager workflow. |
| `src/__tests__/ICDashboard.test.jsx` | IC availability toggle. |
| `src/__tests__/Login.test.jsx` | Login UI (note: requires `VITE_SUPABASE_URL` in test env to pass — skipped locally if unset). |
| **`src/__tests__/integrations.test.js`** | **New.** Adapter-contract tests: mock and live adapters must expose the same methods, mock responses must match the shape the UI consumes. |

**Golden rule:** if you add a method to a live adapter, add it to the
mock in the same PR and extend `integrations.test.js`. That is what
keeps the mock → live flip painless.

---

## Deployment checklist

```bash
npm run build            # outputs dist/ (Vite)
supabase db push         # runs pending migrations
supabase functions deploy auth-jit-sync
supabase functions deploy scim-users
supabase functions deploy sync-calendars
supabase functions deploy zoom-create-meeting
```

For the integration-specific credentials (Google OAuth, Zoom S2S, Okta
OIDC, SCIM bearer), see [docs/GO_LIVE.md](docs/GO_LIVE.md).

---

## Next steps for the engineer finishing the integrations

Ordered by blast radius (smallest → biggest).

### 1. Hierarchy — **done**, just use it
- Train admins on the new CSV columns (`manager_email`, `admin_email`).
- Optional: back-fill the hierarchy for existing profiles via the bulk RPC.

### 2. Okta SSO (~½ day once IT provisions the app)
- Register the OIDC app in Okta, wire into Supabase via
  `supabase sso providers add oidc ...`.
- Populate `app_settings.okta_group_role_map` JSON.
- Flip `features.okta_sso = true`.
- Verify `auth_audit_log` rows appear for test logins.

### 3. Okta SCIM (~½ day, piggybacks on 2)
- Enable SCIM provisioning on the same Okta app.
- Point it at `https://YOUR_PROJECT.functions.supabase.co/scim-users`.
- Set `OKTA_SCIM_BEARER_TOKEN` via `supabase secrets set`.
- Flip `features.okta_scim = true`.

### 4. Calendar — Google (~1–2 days)
- Create Google Cloud OAuth client with `calendar.readonly` scope.
- Implement the small TODO in `supabase/functions/sync-calendars/index.ts`
  (`fetchGoogleEvents`): decrypt token, call events endpoint with
  `syncToken`, update `sync_cursor`. The surrounding upsert path is ready.
- Add a sibling `calendar-oauth-callback` function to complete the
  `code → token` exchange and write `calendar_connections`.
- Uncomment the `pg_cron` schedule at the bottom of
  `20260423120005_calendar_sync.sql`.
- Flip `features.calendar_sync = true`, set `VITE_CALENDAR_MODE=live`.

### 5. Calendar — Outlook (stretch)
- Implement the `outlook` branch in `syncOne()` mirroring the Google
  shape. Connection/slot tables already support it.

### 6. Zoom (~1–2 days)
- Create a **Server-to-Server OAuth** app in Zoom Marketplace.
- Implement `mintZoomAccessToken()` in
  `supabase/functions/zoom-create-meeting/index.ts` (commented curl is
  already in place) and the two `POST /meetings` calls in `createOnUser`
  / `createOnRoom`.
- Populate `profiles.zoom_user_id` (CSV column or a follow-up
  `fn_zoom_sync_users` function).
- Flip `features.zoom_meeting_api = true`, set `VITE_ZOOM_MODE=live`.

### 7. Hardening — post-go-live
- Tighten RLS on the integration tables (policies ship permissive to
  match the rest of the codebase — see
  [Nuances](#nuances-and-gotchas)).
- Replace the SCIM `*` CORS origin with the concrete app origin.
- Add a Grafana / Supabase Logs board on
  `integration_audit_log WHERE severity IN ('warn','error')`.
- Move token storage from the `_ciphertext` columns into actual
  `pgsodium` / Supabase Vault encryption (columns are already named to
  reflect the intent).

---

## Nuances and gotchas

1. **Dual auth is permanent.** Keep magic link + PIN alongside Okta
   indefinitely. Admins need a break-glass path; removing either breaks
   disaster recovery.

2. **Mock adapters always report `isConfigured() === true`.** That is
   deliberate — designers and PMs see the button in dev. In production,
   the live adapter checks the relevant env var and returns `false` if
   unset, so the UI hides the button. If you see the Okta button in a
   live build and it does nothing, the env var is missing — not a bug in
   the adapter.

3. **The Zoom Generate button is additive, not a replacement.** Manual
   paste is the fallback. Never remove it; operators have used it during
   every Zoom outage we know about.

4. **Idempotency keys matter on retries.** The Zoom adapter mints a UUID
   `client_request_id` unless the caller passes one. If you add a retry
   loop upstream, pass the **same** id — otherwise you will create
   duplicate meetings and burn quota.

5. **Calendar sync never writes to `bps_slots`.** It writes only to
   `calendar_open_slots`. Dispatch joins the two at read-time. Keep
   them decoupled; it lets the dispatch state machine evolve without
   breaking calendar ingestion.

6. **Hierarchy trigger runs on every profile write.** Bulk CSV paths
   insert profiles first, *then* call the assignment RPC — because the
   trigger needs both rows to exist to validate the FK. Don't inline the
   assignment into the initial INSERT.

7. **Audit writes never throw.** `recordAudit` / `audit` swallow errors
   on purpose; observability must not break dispatch. If audit rows stop
   appearing, check the table, not the call sites.

8. **RLS is currently permissive.** Every integration migration ships
   with a wide-open policy named after what the production policy should
   be. Tightening is a post-go-live task, not a pre-merge one — it is
   tracked in the GO_LIVE runbook so we don't accidentally cut access
   mid-feature-rollout.

9. **Edge functions run with the service-role key.** Never import
   `_shared/supabaseAdmin.ts` from client code. It would ship the
   service role to the browser.

10. **OIDC JIT has an email-mismatch guard.** `auth-jit-sync` rejects
    with `403 email_mismatch` if the body email differs from the JWT's
    email. Do not "fix" this by removing the check — it is defence in
    depth against a caller using a valid JWT to provision a different
    identity.

---

## Repository map

```
.
├── README.md                      ← you are here
├── .env.example                   ← every env var the code reads
├── docs/
│   └── GO_LIVE.md                 ← per-integration last-mile runbook
├── package.json                   ← scripts: dev / build / test / lint
├── vite.config.js
├── src/
│   ├── main.jsx, App.jsx
│   ├── pages/                     Admin, Manager, IC, Login
│   ├── components/                Leaf UI (+ manager/ sub-tree)
│   ├── hooks/                     Data-fetching / business logic
│   ├── context/AuthContext.jsx    Three-path auth
│   ├── lib/
│   │   ├── supabase.js            Client singleton
│   │   ├── integrations/
│   │   │   ├── index.js           Adapter factory
│   │   │   ├── featureFlags.js    Cached flag lookup + hook
│   │   │   └── auditLog.js        Client-side audit writer
│   │   ├── auth/                  oktaAdapter.js + oktaMockAdapter.js
│   │   ├── calendar/              googleAdapter.js + mockAdapter.js
│   │   └── zoom/                  liveAdapter.js + mockAdapter.js
│   └── __tests__/                 Vitest specs (incl. adapter contracts)
└── supabase/
    ├── migrations/                Timestamped DDL; newest = integrations
    └── functions/
        ├── _shared/               corsHeaders, supabaseAdmin, audit
        ├── auth-jit-sync/         Okta OIDC → profile row
        ├── scim-users/            SCIM 2.0 /Users
        ├── sync-calendars/        Cron-driven event sync
        └── zoom-create-meeting/   Idempotent meeting creation
```

---

## Questions? Bugs?

Open an issue or ping the dispatch team. For integration-specific
config, start at [docs/GO_LIVE.md](docs/GO_LIVE.md). For the mental
model behind the adapter pattern, start at
[src/lib/integrations/index.js](src/lib/integrations/index.js) — it is
the shortest file in the repo and carries the most design weight.
