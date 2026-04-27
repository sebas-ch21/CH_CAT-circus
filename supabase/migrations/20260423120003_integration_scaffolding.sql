/*
  # Integration Scaffolding

  Central plumbing for the three upcoming integrations (Calendar, Zoom,
  Okta). Ships the database side only — the actual network calls live in
  Supabase Edge Functions, and their schemas live in per-feature
  migrations. Everything in here is deliberately neutral and works
  whether or not external credentials ever land.

  ## What this migration creates
  1. `app_settings` rows for feature flags (`features` JSON). The UI
     reads this to decide whether to render integration entry-points.
     Default = everything OFF so the app behaves exactly as before.
  2. `integration_audit_log` — a generic append-only log shared by all
     three integrations. Each row carries a `source` discriminator
     ("calendar" / "zoom" / "okta" / "scim" / "auth") plus a free-form
     `payload` for correlation ids and error blobs.
  3. Permissive RLS consistent with the rest of the codebase; tighten
     before production.

  ## Why feature flags here (not in .env)
  Admins can toggle integrations live without a redeploy. Engineers
  control environment bootstrapping via `.env` (client creds, Vault
  secrets), but runtime on/off is a DB setting.
*/

-- ============================================================
-- 1. FEATURE FLAG ROW
-- ============================================================
-- `app_settings` already exists from 20260401135029. We reuse it to
-- avoid proliferating one-off config tables.

INSERT INTO public.app_settings (setting_key, setting_value)
VALUES (
  'features',
  -- NOTE: stored as JSON-ish text so the existing app_settings schema
  -- (text/text) does not need altering. Readers should JSON.parse().
  '{"calendar_sync":false,"zoom_meeting_api":false,"okta_sso":false,"okta_scim":false}'
)
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 2. INTEGRATION AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.integration_audit_log (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Discriminator so downstream dashboards can filter easily.
  source         text NOT NULL CHECK (source IN ('calendar','zoom','okta','scim','auth','other')),
  -- Free-form action name: "token_refresh", "create_meeting", "jit_provision", etc.
  action         text NOT NULL,
  -- Optional link back to the authenticated profile this action was performed for.
  actor_profile  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Severity helps log-based alerting filter at scale.
  severity       text NOT NULL DEFAULT 'info'
                 CHECK (severity IN ('debug','info','warn','error')),
  -- Correlation id threaded from the edge function through to the client,
  -- so a single dispatch attempt can be traced end-to-end.
  correlation_id text,
  -- Whatever structured blob the caller wants to record (Zoom response,
  -- SCIM payload, error stack, etc.). Keep PII to a minimum.
  payload        jsonb DEFAULT '{}'::jsonb,
  created_at     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_audit_log_source_created
  ON public.integration_audit_log(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_audit_log_correlation
  ON public.integration_audit_log(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- ============================================================
-- 3. RLS (permissive, matching the rest of the codebase)
-- ============================================================
ALTER TABLE public.integration_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_all" ON public.integration_audit_log;
CREATE POLICY "audit_select_all" ON public.integration_audit_log
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "audit_insert_all" ON public.integration_audit_log;
CREATE POLICY "audit_insert_all" ON public.integration_audit_log
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE public.integration_audit_log IS
  'Shared append-only log for Calendar, Zoom, Okta and SCIM integrations.';
