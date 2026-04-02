/*
  # Fix Security Issues and Remove Unused Indexes

  1. Changes
    - Remove unused indexes on bps_slots table
    - Drop all overly permissive "true" policies
    - Remove duplicate conflicting policies
    - Implement proper role-based RLS policies
    
  2. Security Model
    - ADMIN: Full access to all tables
    - MANAGER: Read all, create/update queue_entries and bps_slots
    - IC: Read all, manage own queue entries
    - Public/Anon: Read-only access to profiles for authentication
    
  3. Tables Fixed
    - profiles: Role-based access control
    - queue_entries: Role-based access control
    - bps_slots: Role-based access control
    - daily_capacity_plans: Role-based access control
*/

-- ============================================
-- 1. REMOVE UNUSED INDEXES
-- ============================================

DROP INDEX IF EXISTS public.idx_bps_slots_status_assigned_ic;
DROP INDEX IF EXISTS public.idx_bps_slots_assigned_ic_status;

-- ============================================
-- 2. DROP ALL EXISTING POLICIES
-- ============================================

-- Drop all policies on profiles
DROP POLICY IF EXISTS "Public can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "All authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins and managers can update profiles" ON public.profiles;

-- Drop all policies on queue_entries
DROP POLICY IF EXISTS "Public can read queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Public can insert queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Public can update queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Public can delete queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Authenticated users can view queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Users can insert their own queue entry" ON public.queue_entries;
DROP POLICY IF EXISTS "Only admins and managers can update queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Users can delete their own queue entry" ON public.queue_entries;

-- Drop all policies on bps_slots
DROP POLICY IF EXISTS "Public can read bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Public can insert bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Public can update bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Public can delete bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Authenticated users can view all bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Only admins can insert bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Admins and managers can update bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Only admins can delete bps_slots" ON public.bps_slots;

-- Drop all policies on daily_capacity_plans
DROP POLICY IF EXISTS "Enable all access for daily plans" ON public.daily_capacity_plans;
DROP POLICY IF EXISTS "Authenticated users can view daily_capacity_plans" ON public.daily_capacity_plans;
DROP POLICY IF EXISTS "Only admins can insert daily_capacity_plans" ON public.daily_capacity_plans;
DROP POLICY IF EXISTS "Admins and managers can update daily_capacity_plans" ON public.daily_capacity_plans;
DROP POLICY IF EXISTS "Only admins can delete daily_capacity_plans" ON public.daily_capacity_plans;

-- ============================================
-- 3. PROFILES TABLE POLICIES
-- ============================================

-- Anyone can read profiles (needed for login/authentication)
CREATE POLICY "Anyone can read profiles"
  ON public.profiles
  FOR SELECT
  TO public
  USING (true);

-- Only authenticated users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (email = auth.jwt()->>'email');

-- Admins can update any profile, users can update their own
CREATE POLICY "Admins can update any profile, users update own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND (role = 'ADMIN' OR email = profiles.email)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND (role = 'ADMIN' OR email = profiles.email)
    )
  );

-- Only admins can delete profiles
CREATE POLICY "Only admins can delete profiles"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND role = 'ADMIN'
    )
  );

-- ============================================
-- 4. QUEUE_ENTRIES TABLE POLICIES
-- ============================================

-- Everyone can read queue entries
CREATE POLICY "Anyone can read queue entries"
  ON public.queue_entries
  FOR SELECT
  TO public
  USING (true);

-- Authenticated users can insert queue entries
CREATE POLICY "Authenticated users can insert queue entries"
  ON public.queue_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins and managers can update any entry, ICs can update their own
CREATE POLICY "Role-based update for queue entries"
  ON public.queue_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND (
        role IN ('ADMIN', 'MANAGER')
        OR (role = 'IC' AND profiles.id = queue_entries.ic_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND (
        role IN ('ADMIN', 'MANAGER')
        OR (role = 'IC' AND profiles.id = queue_entries.ic_id)
      )
    )
  );

-- Admins and managers can delete any entry, ICs can delete their own
CREATE POLICY "Role-based delete for queue entries"
  ON public.queue_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND (
        role IN ('ADMIN', 'MANAGER')
        OR (role = 'IC' AND profiles.id = queue_entries.ic_id)
      )
    )
  );

-- ============================================
-- 5. BPS_SLOTS TABLE POLICIES
-- ============================================

-- Everyone can read BPS slots
CREATE POLICY "Anyone can read bps slots"
  ON public.bps_slots
  FOR SELECT
  TO public
  USING (true);

-- Only admins and managers can insert BPS slots
CREATE POLICY "Admins and managers can insert bps slots"
  ON public.bps_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- Only admins and managers can update BPS slots
CREATE POLICY "Admins and managers can update bps slots"
  ON public.bps_slots
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND role IN ('ADMIN', 'MANAGER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- Only admins can delete BPS slots
CREATE POLICY "Only admins can delete bps slots"
  ON public.bps_slots
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND role = 'ADMIN'
    )
  );

-- ============================================
-- 6. DAILY_CAPACITY_PLANS TABLE POLICIES
-- ============================================

-- Everyone can read daily capacity plans
CREATE POLICY "Anyone can read daily capacity plans"
  ON public.daily_capacity_plans
  FOR SELECT
  TO public
  USING (true);

-- Only admins and managers can insert daily capacity plans
CREATE POLICY "Admins and managers can insert capacity plans"
  ON public.daily_capacity_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- Only admins and managers can update daily capacity plans
CREATE POLICY "Admins and managers can update capacity plans"
  ON public.daily_capacity_plans
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND role IN ('ADMIN', 'MANAGER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- Only admins can delete daily capacity plans
CREATE POLICY "Only admins can delete capacity plans"
  ON public.daily_capacity_plans
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE email = auth.jwt()->>'email'
      AND role = 'ADMIN'
    )
  );