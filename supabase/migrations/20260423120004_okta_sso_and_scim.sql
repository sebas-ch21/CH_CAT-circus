/*
  # Okta SSO + SCIM scaffolding (Feature 4)

  Adds the database plumbing the Okta integration needs. The actual
  OIDC handshake is delegated to Supabase Auth's built-in SSO feature,
  which expects provider configuration at the Supabase-project level
  (CLI: `supabase sso providers add oidc ...`). We only store:

  1. A configurable group → role map so IT can re-shuffle Okta
     groups without a code change.
  2. A per-login JIT audit trail.
  3. A SCIM subject identity table so deactivations from Okta can be
     mapped back to a `profiles` row without leaking PII.
*/

-- ============================================================
-- 1. GROUP → ROLE MAP  (seed)
-- ============================================================
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES (
  'okta_group_role_map',
  '{"charlie-admins":"ADMIN","charlie-managers":"MANAGER","charlie-ics":"IC"}'
)
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 2. JIT PROVISIONING AUDIT (per-login record)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Email from the OIDC id_token, already lower-cased.
  email          text NOT NULL,
  -- The role resolved from the Okta group claim.
  resolved_role  app_role,
  -- All groups returned by Okta, stored verbatim for audit.
  okta_groups    text[] DEFAULT '{}',
  -- 'login' | 'jit_create' | 'jit_update' | 'role_mismatch'
  event          text NOT NULL,
  -- Full claim blob minus PII-heavy fields (engineers decide what
  -- to strip — schema stays flexible).
  claims         jsonb DEFAULT '{}'::jsonb,
  created_at     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_email_time
  ON public.auth_audit_log(email, created_at DESC);

ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_audit_select_all" ON public.auth_audit_log;
CREATE POLICY "auth_audit_select_all" ON public.auth_audit_log
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "auth_audit_insert_all" ON public.auth_audit_log;
CREATE POLICY "auth_audit_insert_all" ON public.auth_audit_log
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 3. SCIM SUBJECT MAP
-- ============================================================
-- Okta sends a stable `externalId` for every user; we keep it mapped
-- to our `profiles.id` so subsequent PATCH/DELETE operations find the
-- right row even if the email is later renamed in Okta.
CREATE TABLE IF NOT EXISTS public.scim_subjects (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id  text UNIQUE NOT NULL,   -- Okta `externalId`
  profile_id   uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  active       boolean DEFAULT true NOT NULL,
  last_sync_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scim_subjects_profile ON public.scim_subjects(profile_id);

ALTER TABLE public.scim_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scim_select_all" ON public.scim_subjects;
CREATE POLICY "scim_select_all" ON public.scim_subjects
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "scim_write_all" ON public.scim_subjects;
CREATE POLICY "scim_write_all" ON public.scim_subjects
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.scim_subjects IS
  'Stable Okta → profile mapping used by the SCIM Users endpoint.';
