/*
  # Fix pgcrypto search_path for PIN RPCs

  ## Problem
  On Supabase, pgcrypto is installed in the `extensions` schema, not `public`.
  The previous migration (20260423120001_lockdown_rls_and_pins.sql) set the
  function search_path to `public` only, so `gen_salt()` and `crypt()` are
  not resolvable inside fn_admin_update_pin / fn_verify_pin. Calling either
  raises `function gen_salt(unknown) does not exist`.

  ## Fix
  ALTER both functions to include `extensions` in the search_path. This is
  safe and idempotent — re-running has no effect after the first time.

  ## Why not CREATE OR REPLACE
  ALTER FUNCTION ... SET search_path is a targeted change that leaves the
  function body untouched. It also works regardless of whether the previous
  definition used SECURITY DEFINER, LANGUAGE plpgsql, etc.
*/

ALTER FUNCTION public.fn_admin_update_pin(text, text)
  SET search_path = public, extensions;

ALTER FUNCTION public.fn_verify_pin(text, text)
  SET search_path = public, extensions;
