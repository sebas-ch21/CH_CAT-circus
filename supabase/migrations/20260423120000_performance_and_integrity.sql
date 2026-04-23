/*
  # Performance & Integrity Hardening

  ## Summary
  Adds indexes for hot-path queries, an integrity constraint on bps_slots so
  ASSIGNED rows are guaranteed to have an assigned_at timestamp, and fixes
  cleanup_stale_data to compare against the business-day boundary in Mountain
  Time instead of UTC (which was wiping OPEN slots at 5-6pm local time).

  ## Why this is safe
  - All indexes use IF NOT EXISTS and CREATE INDEX CONCURRENTLY where possible.
    (We fall back to plain CREATE INDEX here because migrations run inside a
    single transaction; CONCURRENTLY is not permitted inside a transaction.)
  - The CHECK constraint is added with NOT VALID so it only enforces new
    writes — existing rows are not scanned. We also run a one-time healing
    UPDATE before adding it so any historical drift is repaired.
  - cleanup_stale_data is replaced with CREATE OR REPLACE, preserving the
    function signature (void). No caller needs to change.
*/

-- ============================================================
-- 1. HEAL ANY EXISTING INTEGRITY DRIFT
--    If status = 'ASSIGNED' but assigned_at is NULL, reset it to OPEN.
--    This can happen if an older code path set status without assigned_at.
-- ============================================================

UPDATE public.bps_slots
SET status = 'OPEN', assigned_ic_id = NULL
WHERE status = 'ASSIGNED' AND assigned_at IS NULL;

-- ============================================================
-- 2. INTEGRITY: ASSIGNED rows must carry an assigned_at timestamp
-- ============================================================

ALTER TABLE public.bps_slots
  DROP CONSTRAINT IF EXISTS bps_slots_assigned_at_required;

ALTER TABLE public.bps_slots
  ADD CONSTRAINT bps_slots_assigned_at_required
  CHECK (status <> 'ASSIGNED' OR assigned_at IS NOT NULL)
  NOT VALID;

-- ============================================================
-- 3. INDEXES FOR HOT PATHS
-- ============================================================

-- Dispatch screens filter slots by status + start_time; this index covers both
-- the manager center feed and the admin panel slot list.
CREATE INDEX IF NOT EXISTS idx_bps_slots_status_start_time
  ON public.bps_slots (status, start_time);

-- cleanup_stale_data and the IC 5-minute countdown scan ASSIGNED slots by
-- assigned_at. A partial index keeps this tiny.
CREATE INDEX IF NOT EXISTS idx_bps_slots_assigned_at_when_assigned
  ON public.bps_slots (assigned_at)
  WHERE status = 'ASSIGNED';

-- Recent-dispatch feed in the manager UI sorts dispatch_logs by matched_at DESC.
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_matched_at_desc
  ON public.dispatch_logs (matched_at DESC);

-- Per-IC history lookups.
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_ic_id
  ON public.dispatch_logs (ic_id);

-- Manager schedules are always queried by (schedule_date) and sometimes
-- (schedule_date, manager_email). A composite index covers both.
CREATE INDEX IF NOT EXISTS idx_manager_schedules_date_manager
  ON public.manager_schedules (schedule_date, manager_email);

-- Queue entries are always looked up by ic_id when enqueueing/dequeueing.
CREATE INDEX IF NOT EXISTS idx_queue_entries_ic_id
  ON public.queue_entries (ic_id);

-- ============================================================
-- 4. FIX cleanup_stale_data TO USE MOUNTAIN TIME
--    CURRENT_DATE runs in the server's configured TZ (UTC on Supabase).
--    At 00:00 UTC (~17:00 MT) it was wiping that day's OPEN slots.
--    date_trunc('day', NOW() AT TIME ZONE 'America/Denver') gives the
--    local business-day boundary, which is what we actually want.
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_stale_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stale_assigned_time TIMESTAMPTZ := NOW() - INTERVAL '5 minutes';
  local_day_start TIMESTAMPTZ := (date_trunc('day', NOW() AT TIME ZONE 'America/Denver')) AT TIME ZONE 'America/Denver';
  expired_record RECORD;
BEGIN
  -- A. Revert ASSIGNED slots that have expired (>5 min without confirm).
  FOR expired_record IN
    SELECT id, assigned_ic_id FROM bps_slots
    WHERE status = 'ASSIGNED' AND assigned_at < stale_assigned_time
  LOOP
    UPDATE bps_slots
    SET status = 'OPEN', assigned_ic_id = NULL, assigned_at = NULL
    WHERE id = expired_record.id;

    IF expired_record.assigned_ic_id IS NOT NULL THEN
      UPDATE profiles SET current_status = 'IN_QUEUE'
      WHERE id = expired_record.assigned_ic_id;

      IF NOT EXISTS (SELECT 1 FROM queue_entries WHERE ic_id = expired_record.assigned_ic_id) THEN
        INSERT INTO queue_entries (ic_id, entered_at)
        VALUES (expired_record.assigned_ic_id, NOW());
      END IF;
    END IF;
  END LOOP;

  -- B. Overnight wipe of OPEN slots whose start_time is before today's
  --    Mountain Time day-start. Future-dated slots are untouched.
  DELETE FROM bps_slots
  WHERE status = 'OPEN' AND start_time < local_day_start;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'cleanup_stale_data warning: %', SQLERRM;
END;
$$;
