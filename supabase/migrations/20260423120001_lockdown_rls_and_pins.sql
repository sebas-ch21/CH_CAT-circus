/*
  # Lock Down PINs: Hash At Rest, No Anon Reads

  ## Problem we're fixing
  Today, PINs (admin_pin, manager_pin, access_pin) are stored in app_settings
  as plaintext, and the anon key can SELECT them. Anyone with the public
  Supabase URL + anon key can read admin/manager PINs out of the database.

  ## What this migration does
  1. Enables pgcrypto (for crypt() / gen_salt()).
  2. Hashes any existing plaintext PINs in-place using bcrypt. Already-hashed
     rows (those starting with `$2`) are left alone so this migration is
     idempotent.
  3. Creates fn_verify_pin(p_role, p_pin) -> boolean: a SECURITY DEFINER RPC
     that does constant-time-ish bcrypt comparison and returns true/false.
     The client never sees the hash.
  4. Creates fn_admin_update_pin(p_key, p_value) -> void: a SECURITY DEFINER
     RPC that hashes the new PIN and upserts into app_settings. The client
     never sends a hash; it sends the new plaintext and the server hashes it.
  5. Revokes anon SELECT on app_settings and drops the matching RLS policy.
     Anon can still UPDATE/INSERT via the RPCs; direct reads are gone.

  ## Compatibility
  - The client has already been updated to use both RPCs (AuthContext uses
    fn_verify_pin; AdminPanel uses fn_admin_update_pin). No direct reads of
    app_settings remain in the codebase.
  - Function signatures are new (no pre-existing RPCs with these names), so
    there's nothing to drop.
*/

-- ============================================================
-- 1. EXTENSION
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 2. HASH EXISTING PLAINTEXT PINS (IDEMPOTENT)
--    bcrypt hashes start with $2 — if we see one, it's already hashed.
-- ============================================================

UPDATE public.app_settings
SET setting_value = crypt(setting_value, gen_salt('bf'))
WHERE setting_key IN ('admin_pin', 'manager_pin', 'access_pin')
  AND setting_value NOT LIKE '$2%';

-- ============================================================
-- 3. fn_verify_pin: verify a plaintext PIN against the stored hash
--    Returns false for unknown roles instead of raising, so callers can
--    distinguish "wrong PIN" from "DB error" by the rpc error object.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_verify_pin(p_role text, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key  text;
  v_hash text;
BEGIN
  IF p_pin IS NULL OR length(p_pin) = 0 THEN
    RETURN false;
  END IF;

  v_key := CASE
    WHEN p_role = 'ADMIN'   THEN 'admin_pin'
    WHEN p_role = 'MANAGER' THEN 'manager_pin'
    ELSE NULL
  END;

  IF v_key IS NULL THEN
    RETURN false;
  END IF;

  SELECT setting_value INTO v_hash
  FROM app_settings
  WHERE setting_key = v_key;

  IF v_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN crypt(p_pin, v_hash) = v_hash;
END;
$$;

-- ============================================================
-- 4. fn_admin_update_pin: set/rotate a PIN with a freshly hashed value
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_admin_update_pin(p_key text, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_key NOT IN ('admin_pin', 'manager_pin', 'access_pin') THEN
    RAISE EXCEPTION 'Invalid PIN key: %', p_key;
  END IF;

  IF p_value IS NULL OR length(p_value) < 4 THEN
    RAISE EXCEPTION 'PIN must be at least 4 characters.';
  END IF;

  INSERT INTO app_settings (setting_key, setting_value, updated_at)
  VALUES (p_key, crypt(p_value, gen_salt('bf')), now())
  ON CONFLICT (setting_key)
  DO UPDATE SET setting_value = EXCLUDED.setting_value,
                updated_at    = now();
END;
$$;

-- ============================================================
-- 5. REMOVE ANON READ ACCESS ON app_settings
--    Drop the permissive SELECT policy added in
--    20260407223950_rebuild_state_machine_rpcs_and_rls.sql and replace it
--    with no policy at all (RLS-enabled tables deny by default).
--    INSERT/UPDATE anon policies remain so the RPCs (which run as definer)
--    are unaffected, but also so any legacy client write path keeps working
--    until it's migrated off. Reads must go through the RPCs.
-- ============================================================

DROP POLICY IF EXISTS "settings_select_all" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.app_settings;

-- ============================================================
-- 6. GRANT EXECUTE ON THE NEW RPCs TO anon + authenticated
--    Supabase PostgREST exposes functions callable by these roles.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.fn_verify_pin(text, text)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_update_pin(text, text) TO anon, authenticated;
