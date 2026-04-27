/*
  # Calendar Sync (Feature 1)

  Stores per-user OAuth tokens (encrypted at rest), the parsed "open"
  slots we derive from calendar events, and the flag token an admin
  can tweak.

  ## Tables
    - calendar_connections  (1 row per user per provider)
    - calendar_open_slots   (n rows per connection, upserted by the sync job)

  ## Security notes
  - Tokens are stored in `*_ciphertext` columns. Engineers finishing
    the integration should enable `pgsodium` and use a KMS key to
    keep the plaintext outside of Postgres logs. If pgsodium is not
    available, Supabase Vault can be used instead; both paths are
    called out in docs/GO_LIVE.md.
  - RLS ships permissive (consistent with the rest of this repo)
    but the intent is already expressed in policy names.
*/

-- ============================================================
-- 1. CONNECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id           uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  provider             text NOT NULL CHECK (provider IN ('google','outlook')),
  -- Encrypted token material. Plaintext columns intentionally absent.
  access_token_ciphertext  text,
  refresh_token_ciphertext text,
  token_expires_at     timestamptz,
  scope                text,
  -- The canonical calendar id inside the provider. For Google this is
  -- usually the user's primary email, but we store it explicitly to
  -- future-proof multi-calendar sync.
  external_calendar_id text,
  -- Incremental sync cursor (Google `syncToken`, Outlook `deltaLink`).
  sync_cursor          text,
  last_sync_at         timestamptz,
  last_error           text,
  created_at           timestamptz DEFAULT now() NOT NULL,
  updated_at           timestamptz DEFAULT now() NOT NULL,
  UNIQUE (profile_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_last_sync
  ON public.calendar_connections(last_sync_at);

-- ============================================================
-- 2. OPEN SLOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.calendar_open_slots (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id   uuid REFERENCES public.calendar_connections(id) ON DELETE CASCADE NOT NULL,
  profile_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  -- Identifier from the source calendar so upserts are idempotent.
  source_event_id text NOT NULL,
  title_flag      text NOT NULL,          -- e.g. "[BPS-OPEN]"
  synced_at       timestamptz DEFAULT now() NOT NULL,
  UNIQUE (connection_id, source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_open_slots_profile_time
  ON public.calendar_open_slots(profile_id, start_time);

-- ============================================================
-- 3. FLAG TOKEN CONFIG
-- ============================================================
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES ('calendar_flag_token', '[BPS-OPEN]')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_open_slots  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_conn_select_all" ON public.calendar_connections;
CREATE POLICY "calendar_conn_select_all" ON public.calendar_connections
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "calendar_conn_write_all" ON public.calendar_connections;
CREATE POLICY "calendar_conn_write_all" ON public.calendar_connections
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "calendar_slots_select_all" ON public.calendar_open_slots;
CREATE POLICY "calendar_slots_select_all" ON public.calendar_open_slots
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "calendar_slots_write_all" ON public.calendar_open_slots;
CREATE POLICY "calendar_slots_write_all" ON public.calendar_open_slots
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. CLEANUP EXTENSION TO cleanup_stale_data
-- ============================================================
-- Drop open-slot rows older than 30 days so the table doesn't grow
-- unbounded. Safe even if the sync job never ran.
CREATE OR REPLACE FUNCTION public.cleanup_calendar_open_slots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.calendar_open_slots
  WHERE start_time < (NOW() - INTERVAL '30 days');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'cleanup_calendar_open_slots failed: %', SQLERRM;
END;
$$;

-- ============================================================
-- 6. PG_CRON SCHEDULE (commented; enable at go-live time)
-- ============================================================
-- The actual sync happens in the `sync-calendars` Edge Function. We
-- schedule it via pg_cron → `net.http_post` once the engineer
-- populates the Supabase project reference below. Left commented to
-- avoid a failing migration in dev environments without pg_cron.
--
-- SELECT cron.schedule(
--   'sync-calendars-every-10m',
--   '*/10 * * * *',
--   $$
--     SELECT net.http_post(
--       url := 'https://YOUR_PROJECT.functions.supabase.co/sync-calendars',
--       headers := jsonb_build_object(
--         'Content-Type','application/json',
--         'Authorization','Bearer ' || current_setting('app.cron_secret', true)
--       ),
--       body := '{}'::jsonb
--     );
--   $$
-- );
