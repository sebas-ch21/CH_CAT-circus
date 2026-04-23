/*
  # IC → Manager → Admin Hierarchy

  Adds organizational hierarchy to the `profiles` table so every IC can be
  mapped to a Manager, and every Manager can optionally be mapped to an
  Admin. This enables downstream features (dispatch routing, reporting,
  Zoom-link ownership) to resolve chain of command without fuzzy email
  matching.

  ## Changes
  1. New columns on `profiles`:
     - `manager_id` (uuid, nullable, FK → profiles.id, ON DELETE SET NULL)
     - `admin_id`   (uuid, nullable, FK → profiles.id, ON DELETE SET NULL)
  2. Indexes for the common lookup paths.
  3. BEFORE INSERT / UPDATE trigger that enforces role-based rules which
     cannot be expressed as a plain CHECK constraint (because they
     reference another row).
  4. Helper view `v_profile_hierarchy` for convenient joins in queries.

  ## Rules enforced by the trigger
  - If `role = 'IC'`            → `manager_id` MUST point at a MANAGER profile.
  - If `role = 'MANAGER'`       → `admin_id` is optional; if set MUST point at an ADMIN.
  - If `role = 'ADMIN'`         → both fields MUST be NULL (admins sit at the top).
  - `manager_id` can never equal the row's own id (self-reference guard).

  ## Non-goals / forward-compatibility
  - Existing rows are preserved; new FK columns default to NULL.
  - No cascading deletes: orphaning a manager simply nulls the children's
    pointers — dispatch logic must handle that gracefully.
  - No backfill heuristic. Admins pick mappings explicitly via the UI
    or bulk CSV re-upload (see AdminPanel.jsx).
*/

-- ============================================================
-- 1. COLUMNS
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============================================================
-- 2. INDEXES
-- ============================================================
-- Managers often fetch "my ICs", Admins often fetch "my Managers".
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON public.profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_admin_id   ON public.profiles(admin_id);

-- ============================================================
-- 3. HIERARCHY VALIDATION TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_validate_profile_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mgr_role app_role;
  adm_role app_role;
BEGIN
  -- Self-reference guard: you cannot be your own manager or admin.
  IF NEW.manager_id IS NOT NULL AND NEW.manager_id = NEW.id THEN
    RAISE EXCEPTION 'A profile cannot be its own manager (id=%).', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.admin_id IS NOT NULL AND NEW.admin_id = NEW.id THEN
    RAISE EXCEPTION 'A profile cannot be its own admin (id=%).', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Role-specific rules.
  IF NEW.role = 'ADMIN' THEN
    -- Admins sit at the top; both pointers must be NULL.
    IF NEW.manager_id IS NOT NULL OR NEW.admin_id IS NOT NULL THEN
      RAISE EXCEPTION 'ADMIN profiles must have NULL manager_id and admin_id.'
        USING ERRCODE = 'check_violation';
    END IF;

  ELSIF NEW.role = 'MANAGER' THEN
    -- Managers must not have a manager; admin_id is optional but must
    -- point at an ADMIN when present.
    IF NEW.manager_id IS NOT NULL THEN
      RAISE EXCEPTION 'MANAGER profiles must have NULL manager_id (managers do not report to managers).'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.admin_id IS NOT NULL THEN
      SELECT role INTO adm_role FROM public.profiles WHERE id = NEW.admin_id;
      IF adm_role IS DISTINCT FROM 'ADMIN'::app_role THEN
        RAISE EXCEPTION 'admin_id must reference a profile with role = ADMIN (got %).', adm_role
          USING ERRCODE = 'foreign_key_violation';
      END IF;
    END IF;

  ELSIF NEW.role = 'IC' THEN
    -- ICs should always have a manager; we allow NULL for backfill but
    -- if set it MUST point at a MANAGER.
    IF NEW.manager_id IS NOT NULL THEN
      SELECT role INTO mgr_role FROM public.profiles WHERE id = NEW.manager_id;
      IF mgr_role IS DISTINCT FROM 'MANAGER'::app_role THEN
        RAISE EXCEPTION 'manager_id must reference a profile with role = MANAGER (got %).', mgr_role
          USING ERRCODE = 'foreign_key_violation';
      END IF;
    END IF;
    -- ICs never set admin_id directly; it is derived via their manager.
    IF NEW.admin_id IS NOT NULL THEN
      RAISE EXCEPTION 'IC profiles must leave admin_id NULL (derive it from their manager).'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_profile_hierarchy ON public.profiles;
CREATE TRIGGER trg_validate_profile_hierarchy
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_profile_hierarchy();

-- ============================================================
-- 4. CONVENIENCE VIEW
-- ============================================================
-- Flattens the hierarchy so callers can pull IC, Manager and Admin emails
-- in one query without multiple self-joins.
CREATE OR REPLACE VIEW public.v_profile_hierarchy AS
SELECT
  p.id            AS profile_id,
  p.email         AS profile_email,
  p.role          AS profile_role,
  p.tier_rank     AS tier_rank,
  p.current_status,
  m.id            AS manager_id,
  m.email         AS manager_email,
  COALESCE(a.id, ma.id)       AS admin_id,
  COALESCE(a.email, ma.email) AS admin_email
FROM public.profiles p
LEFT JOIN public.profiles m  ON m.id  = p.manager_id
LEFT JOIN public.profiles a  ON a.id  = p.admin_id
-- When the profile is an IC, its admin is inherited from its manager.
LEFT JOIN public.profiles ma ON ma.id = m.admin_id;

COMMENT ON VIEW public.v_profile_hierarchy IS
  'Flattened IC → Manager → Admin hierarchy. Admin email is inherited from the manager when the profile is an IC.';

-- ============================================================
-- 5. BULK ASSIGNMENT RPC
-- ============================================================
-- Used by the Admin Panel bulk-upload flow. Accepts an array of
-- {profile_email, manager_email, admin_email} objects and applies them
-- atomically. Returns a JSONB result describing successes + failures
-- so the UI can render a resolution modal without a second round-trip.

CREATE OR REPLACE FUNCTION public.fn_bulk_assign_hierarchy(assignments jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item          jsonb;
  target_id     uuid;
  manager_uid   uuid;
  admin_uid     uuid;
  successes     int := 0;
  failures      jsonb := '[]'::jsonb;
BEGIN
  IF assignments IS NULL OR jsonb_typeof(assignments) <> 'array' THEN
    RAISE EXCEPTION 'assignments must be a JSON array';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(assignments)
  LOOP
    target_id   := NULL;
    manager_uid := NULL;
    admin_uid   := NULL;

    -- Resolve the target profile by email.
    SELECT id INTO target_id
      FROM public.profiles
      WHERE email = lower(item->>'profile_email');

    IF target_id IS NULL THEN
      failures := failures || jsonb_build_object(
        'profile_email', item->>'profile_email',
        'error',         'profile_not_found'
      );
      CONTINUE;
    END IF;

    -- Optional manager lookup.
    IF (item ? 'manager_email') AND (item->>'manager_email') <> '' THEN
      SELECT id INTO manager_uid
        FROM public.profiles
        WHERE email = lower(item->>'manager_email') AND role = 'MANAGER';
      IF manager_uid IS NULL THEN
        failures := failures || jsonb_build_object(
          'profile_email', item->>'profile_email',
          'error',         'manager_not_found_or_wrong_role'
        );
        CONTINUE;
      END IF;
    END IF;

    -- Optional admin lookup.
    IF (item ? 'admin_email') AND (item->>'admin_email') <> '' THEN
      SELECT id INTO admin_uid
        FROM public.profiles
        WHERE email = lower(item->>'admin_email') AND role = 'ADMIN';
      IF admin_uid IS NULL THEN
        failures := failures || jsonb_build_object(
          'profile_email', item->>'profile_email',
          'error',         'admin_not_found_or_wrong_role'
        );
        CONTINUE;
      END IF;
    END IF;

    -- Let the trigger enforce role compatibility; if it throws, we capture it.
    BEGIN
      UPDATE public.profiles
      SET manager_id = manager_uid,
          admin_id   = admin_uid,
          updated_at = now()
      WHERE id = target_id;
      successes := successes + 1;
    EXCEPTION WHEN OTHERS THEN
      failures := failures || jsonb_build_object(
        'profile_email', item->>'profile_email',
        'error',         SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success_count', successes,
    'failures',      failures
  );
END;
$$;

COMMENT ON FUNCTION public.fn_bulk_assign_hierarchy(jsonb) IS
  'Atomically apply a batch of IC/Manager → Manager/Admin assignments and return per-row outcomes.';
