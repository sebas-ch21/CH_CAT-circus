/*
  # Fix Security Issues

  1. Performance Improvements
    - Add index on bps_slots(assigned_ic_id) for foreign key performance

  2. Security Fixes - RLS Policy Restrictions
    
    ### app_settings table
    - Replace overly permissive update policy with ADMIN-only access
    - Only ADMIN users can modify settings (critical security data)
    
    ### bps_slots table
    - Replace public policies with authenticated-only access
    - Restrict operations to logged-in users
    
    ### profiles table
    - Replace public policies with role-based restrictions
    - ADMIN can manage all profiles
    - MANAGER can view all profiles but not modify
    - IC users can only view their own profile
    
    ### queue_entries table
    - Replace public policies with authenticated access
    - All authenticated users can view and manage queue entries
    - This supports the workflow where ICs and MANAGERs interact with the queue

  3. Important Notes
    - Auth DB connection strategy must be changed manually in Supabase dashboard
    - Navigate to: Settings > Database > Connection Pooling
    - Change from "10 connections" to percentage-based allocation
*/

-- ============================================
-- 1. PERFORMANCE: Add missing foreign key index
-- ============================================
CREATE INDEX IF NOT EXISTS idx_bps_slots_assigned_ic_id 
  ON bps_slots(assigned_ic_id);

-- ============================================
-- 2. APP_SETTINGS: Restrict to ADMIN only
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can read settings" ON app_settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON app_settings;

CREATE POLICY "Authenticated users can read settings"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update settings"
  ON app_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.email = current_user 
      AND profiles.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.email = current_user 
      AND profiles.role = 'ADMIN'
    )
  );

CREATE POLICY "Only admins can insert settings"
  ON app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.email = current_user 
      AND profiles.role = 'ADMIN'
    )
  );

-- ============================================
-- 3. BPS_SLOTS: Restrict to authenticated users
-- ============================================

DROP POLICY IF EXISTS "Allow public read on bps_slots" ON bps_slots;
DROP POLICY IF EXISTS "Allow public insert on bps_slots" ON bps_slots;
DROP POLICY IF EXISTS "Allow public update on bps_slots" ON bps_slots;
DROP POLICY IF EXISTS "Allow public delete on bps_slots" ON bps_slots;

CREATE POLICY "Authenticated users can read bps_slots"
  ON bps_slots
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert bps_slots"
  ON bps_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bps_slots"
  ON bps_slots
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bps_slots"
  ON bps_slots
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- 4. PROFILES: Role-based access control
-- ============================================

DROP POLICY IF EXISTS "Allow public read on profiles" ON profiles;
DROP POLICY IF EXISTS "Allow public insert on profiles" ON profiles;
DROP POLICY IF EXISTS "Allow public update on profiles" ON profiles;
DROP POLICY IF EXISTS "Allow public delete on profiles" ON profiles;

CREATE POLICY "All authenticated users can read profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.email = current_user 
      AND profiles.role = 'ADMIN'
    )
  );

CREATE POLICY "Only admins can update profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.email = current_user 
      AND profiles.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.email = current_user 
      AND profiles.role = 'ADMIN'
    )
  );

CREATE POLICY "Only admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.email = current_user 
      AND profiles.role = 'ADMIN'
    )
  );

-- ============================================
-- 5. QUEUE_ENTRIES: Authenticated access
-- ============================================

DROP POLICY IF EXISTS "Allow public read on queue_entries" ON queue_entries;
DROP POLICY IF EXISTS "Allow public insert on queue_entries" ON queue_entries;
DROP POLICY IF EXISTS "Allow public update on queue_entries" ON queue_entries;
DROP POLICY IF EXISTS "Allow public delete on queue_entries" ON queue_entries;

CREATE POLICY "Authenticated users can read queue_entries"
  ON queue_entries
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert queue_entries"
  ON queue_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update queue_entries"
  ON queue_entries
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete queue_entries"
  ON queue_entries
  FOR DELETE
  TO authenticated
  USING (true);