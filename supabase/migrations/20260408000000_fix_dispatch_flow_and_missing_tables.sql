/*
  # Fix Dispatch Flow & Missing Tables
  
  1. Creates missing tables: dispatch_logs, manager_schedules, daily_capacity_plans
  2. Applies RLS policies for the new tables
  3. Patches the cleanup_stale_data RPC to use absolute intervals instead of CURRENT_DATE
*/

-- ============================================================
-- 1. CREATE MISSING TABLES (IF THEY DON'T EXIST)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dispatch_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ic_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ic_email text NOT NULL,
  tier_rank integer,
  manager_email text,
  patient_identifier text NOT NULL,
  start_time timestamptz NOT NULL,
  matched_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.manager_schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_email text NOT NULL,
  schedule_date date NOT NULL,
  schedule_data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(manager_email, schedule_date)
);

CREATE TABLE IF NOT EXISTS public.daily_capacity_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_date date UNIQUE NOT NULL,
  plan_data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. ENABLE ROW LEVEL SECURITY & POLICIES
-- ============================================================

ALTER TABLE public.dispatch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_capacity_plans ENABLE ROW LEVEL SECURITY;

-- Dispatch Logs Policies
DROP POLICY IF EXISTS "logs_select_all" ON public.dispatch_logs;
CREATE POLICY "logs_select_all" ON public.dispatch_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "logs_insert_anon" ON public.dispatch_logs;
CREATE POLICY "logs_insert_anon" ON public.dispatch_logs FOR INSERT WITH CHECK (true);

-- Manager Schedules Policies
DROP POLICY IF EXISTS "schedules_select_all" ON public.manager_schedules;
CREATE POLICY "schedules_select_all" ON public.manager_schedules FOR SELECT USING (true);
DROP POLICY IF EXISTS "schedules_insert_anon" ON public.manager_schedules;
CREATE POLICY "schedules_insert_anon" ON public.manager_schedules FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "schedules_update_anon" ON public.manager_schedules;
CREATE POLICY "schedules_update_anon" ON public.manager_schedules FOR UPDATE USING (true) WITH CHECK (true);

-- Daily Capacity Plans Policies
DROP POLICY IF EXISTS "plans_select_all" ON public.daily_capacity_plans;
CREATE POLICY "plans_select_all" ON public.daily_capacity_plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "plans_insert_anon" ON public.daily_capacity_plans;
CREATE POLICY "plans_insert_anon" ON public.daily_capacity_plans FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "plans_update_anon" ON public.daily_capacity_plans;
CREATE POLICY "plans_update_anon" ON public.daily_capacity_plans FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================================
-- 3. PATCH STALE DATA CLEANUP RPC (Fixes Disappearing Slots)
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_stale_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stale_assigned_time TIMESTAMPTZ := NOW() - INTERVAL '5 minutes';
  expired_record RECORD;
BEGIN
  -- A. Handle 5-minute expired ASSIGNED slots
  FOR expired_record IN
    SELECT id, assigned_ic_id FROM bps_slots
    WHERE status = 'ASSIGNED' AND assigned_at < stale_assigned_time
  LOOP
    -- Revert the slot back to OPEN
    UPDATE bps_slots
    SET status = 'OPEN', assigned_ic_id = NULL, assigned_at = NULL
    WHERE id = expired_record.id;

    -- Return the IC to the queue
    IF expired_record.assigned_ic_id IS NOT NULL THEN
      UPDATE profiles SET current_status = 'IN_QUEUE'
      WHERE id = expired_record.assigned_ic_id;

      -- Use IF NOT EXISTS to prevent duplicate key errors
      IF NOT EXISTS (SELECT 1 FROM queue_entries WHERE ic_id = expired_record.assigned_ic_id) THEN
        INSERT INTO queue_entries (ic_id, entered_at)
        VALUES (expired_record.assigned_ic_id, NOW());
      END IF;
    END IF;
  END LOOP;

  -- B. WIPE OLD SLOTS: Use absolute 24-hour interval to bypass UTC date mismatches
  DELETE FROM bps_slots 
  WHERE status = 'OPEN' AND start_time < (NOW() - INTERVAL '24 hours');
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'cleanup_stale_data warning: %', SQLERRM;
END;
$$;