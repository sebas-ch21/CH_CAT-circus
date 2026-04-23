# Go-Live Checklist

This document is the **last-mile runbook** for the engineer who
finishes each integration. Every feature ships in *mock mode* by
default so the app is safe to deploy before any credentials exist.
Flipping `mock → live` should be the final step.

## Global preconditions

1. Copy `.env.example` → `.env` and fill in Supabase URL / anon key.
2. Run pending migrations:
   ```bash
   supabase db push
   ```
3. Ensure the Supabase project has the Edge Functions runtime enabled.
4. Deploy the shared functions lib:
   ```bash
   supabase functions deploy --project-ref YOUR_REF _shared
   ```
   (Note: `_shared` is referenced by the other functions; deploy
   order matters.)

---

## Feature 2 — IC → Manager → Admin Hierarchy

**Status:** complete, no external credentials needed.

Nothing to do here besides confirming the migration `20260423120002`
ran. The Admin Panel picks up the new dropdowns automatically.

---

## Feature 1 — Calendar Sync (Google first, Outlook stub)

**Last-mile checklist**

1. **Google Cloud project**
   - Create an OAuth 2.0 Client (Web app) at
     https://console.cloud.google.com/apis/credentials
   - Authorised redirect URI = `https://YOUR_APP/auth/google/callback`
   - Copy the Client ID into `VITE_GOOGLE_OAUTH_CLIENT_ID`
   - Push the Client ID / Secret into Supabase Vault:
     ```bash
     supabase secrets set \
       GOOGLE_OAUTH_CLIENT_ID=... \
       GOOGLE_OAUTH_CLIENT_SECRET=... \
       GOOGLE_OAUTH_REDIRECT_URI=...
     ```
2. **Edge function** — deploy the sync job:
   ```bash
   supabase functions deploy sync-calendars
   ```
3. **pg_cron** — uncomment the scheduled call at the bottom of
   `20260423120004_calendar_sync.sql`, then run `supabase db push`.
4. **App settings** — in the Admin Panel, flip `features.calendar_sync`
   to `true`. Users will see a **Connect Calendar** button in their
   profile.
5. **Flag token** — the title substring that marks "open" events.
   Default `[BPS-OPEN]`. Change via
   `app_settings.calendar_flag_token` if your team uses a different
   convention.
6. **Switch to live mode** —
   ```
   VITE_CALENDAR_MODE=live
   ```
   Redeploy the client.

**How to verify:** create an event titled `[BPS-OPEN]` in a test
Google account, wait for one cron cycle, confirm the row in
`calendar_open_slots`.

---

## Feature 3 — Zoom Programmatic Meetings + Zoom Rooms

**Last-mile checklist**

1. **Create a Server-to-Server OAuth app** in the Zoom Marketplace:
   https://marketplace.zoom.us/develop/create → "Server-to-Server
   OAuth".
2. **Scopes** required:
   - `meeting:write:admin`
   - `user:read:admin`
   - `room:read:admin`
   - `room:write:admin`
3. **Secrets:**
   ```bash
   supabase secrets set \
     ZOOM_ACCOUNT_ID=... \
     ZOOM_CLIENT_ID=... \
     ZOOM_CLIENT_SECRET=... \
     ZOOM_DAILY_CREATE_CAP=50
   ```
4. **Map managers to Zoom user ids** (one of these):
   - Bulk: import CSV with a `zoom_user_id` column into `profiles`.
   - Automatic: run
     `select fn_zoom_sync_users();`
     which calls `GET /users` via the edge function and populates
     `profiles.zoom_user_id` by email.
5. **(Optional) seed Zoom Rooms**: run
   `select fn_zoom_sync_rooms();`
6. **Deploy edge function:**
   ```bash
   supabase functions deploy zoom-create-meeting
   supabase functions deploy zoom-delete-meeting   # cleanup job
   ```
7. **Flags:**
   - `VITE_ZOOM_MODE=live`
   - `features.zoom_meeting_api = true` (Admin Panel)
   - `zoom_mode = user | rooms | auto` in `app_settings`
8. **Regression smoke:** manual Zoom link paste in `ZoomLinkModal`
   still works as a fallback, which is why the "Generate" button
   is additive rather than replacing.

**Concurrency safety:** the edge function uses `zoom_request_log`
for idempotency. A retried dispatch will return the existing meeting
instead of creating a second one.

---

## Feature 4 — Okta SSO + SCIM

**Last-mile checklist**

1. **Okta OIDC app:**
   - Okta Admin → Applications → "Create App Integration" → OIDC →
     Web Application.
   - Sign-in redirect URI: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - Sign-out redirect URI: `https://YOUR_APP/`
   - Note the Client ID + Secret.
2. **Wire it into Supabase:**
   ```bash
   supabase sso providers add oidc \
     --domain YOUR_TENANT.okta.com \
     --client-id ... \
     --client-secret ...
   ```
3. **Group → role map:** edit `app_settings.okta_group_role_map`
   JSON, for example:
   ```json
   {
     "charlie-admins":   "ADMIN",
     "charlie-managers": "MANAGER",
     "charlie-ics":      "IC"
   }
   ```
4. **SCIM app:**
   - Okta Admin → same application → General → Provisioning → Enable
     SCIM provisioning.
   - SCIM connector base URL:
     `https://YOUR_PROJECT.functions.supabase.co/scim-users`
   - Unique identifier: `email`
   - Authentication: HTTP Header, bearer token =
     `OKTA_SCIM_BEARER_TOKEN` (set via `supabase secrets set ...`).
5. **Flags:**
   - `VITE_OKTA_MODE=live`
   - `features.okta_sso  = true`
   - `features.okta_scim = true`
6. **Cutover plan:** keep magic-link + PIN login enabled for at
   least a release cycle so Admins have a break-glass path.
7. **Deprovision behaviour:** SCIM `active:false` sets
   `profiles.current_status = 'BUSY'` and revokes Supabase sessions.
   A nightly reconciliation job (`supabase functions deploy
   okta-reconcile`) doubles as a safety net.

---

## After every go-live

- Turn on real-time log alerting against the `integration_audit_log`
  table for `severity IN ('warn','error')`.
- Add a dashboard tile for `count(*) GROUP BY source, severity` over
  the last 24 h.
- Tighten RLS on the integration tables once the data shapes settle
  — the migrations ship with permissive policies to keep the app
  functioning exactly like today.
