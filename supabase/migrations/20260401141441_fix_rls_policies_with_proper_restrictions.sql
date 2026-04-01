/*
  # Fix RLS Policies with Proper Access Restrictions

  1. Performance Improvements
    - Add composite index on bps_slots(status, assigned_ic_id) for common query patterns
    - This replaces the unused single-column index
    
  2. Security Fixes - Restrictive RLS Policies
    
    ### bps_slots table
    - SELECT: All authenticated users can view all slots (needed for manager assignment UI)
    - INSERT: Only ADMIN can create new slots (via CSV upload)
    - UPDATE: Only ADMIN and MANAGER can update slots (manager assigns, admin manages)
    - DELETE: Only ADMIN can delete slots
    
    ### queue_entries table  
    - SELECT: All authenticated users can view queue (needed for manager UI)
    - INSERT: ICs can add themselves to queue, managers/admins can manage
    - UPDATE: Only ADMIN and MANAGER can update queue entries
    - DELETE: ICs can remove themselves, managers/admins can remove any
    
  3. Important Notes
    - Auth DB connection strategy must be changed manually in Supabase dashboard
    - Navigate to: Settings > Database > Connection Pooling
    - Change from "10 connections" to percentage-based allocation
    - Policies now enforce role-based access control properly
*/

-- ============================================
-- 1. PERFORMANCE: Replace unused index with composite
-- ============================================

-- Drop the unused single-column index
DROP INDEX IF EXISTS idx_bps_slots_assigned_ic_id;

-- Create composite index for common query pattern: status filtering + IC assignment
CREATE INDEX IF NOT EXISTS idx_bps_slots_status_assigned_ic 
  ON bps_slots(status, assigned_ic_id);

-- Additional index for IC dashboard queries (assigned slots lookup)
CREATE INDEX IF NOT EXISTS idx_bps_slots_assigned_ic_status 
  ON bps_slots(assigned_ic_id, status) 
  WHERE assigned_ic_id IS NOT NULL;

-- ============================================
-- 2. BPS_SLOTS: Role-based access control
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can read bps_slots" ON bps_slots;
DROP POLICY IF EXISTS "Authenticated users can insert bps_slots" ON bps_slots;
DROP POLICY IF EXISTS "Authenticated users can update bps_slots" ON bps_slots;
DROP POLICY IF EXISTS "Authenticated users can delete bps_slots" ON bps_slots;

-- All authenticated users can view slots (managers need this for assignment UI)
CREATE POLICY "Authenticated users can view all bps_slots"
  ON bps_slots
  FOR SELECT
  TO authenticated
  USING (true);

-- Only ADMIN can insert new slots (CSV upload functionality)
CREATE POLICY "Only admins can insert bps_slots"
  ON bps_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'ADMIN'
    )
  );

-- ADMIN and MANAGER can update slots (manager assigns, admin manages)
CREATE POLICY "Admins and managers can update bps_slots"
  ON bps_slots
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

-- Only ADMIN can delete slots
CREATE POLICY "Only admins can delete bps_slots"
  ON bps_slots
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'ADMIN'
    )
  );

-- ============================================
-- 3. QUEUE_ENTRIES: Role-based with self-management
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can read queue_entries" ON queue_entries;
DROP POLICY IF EXISTS "Authenticated users can insert queue_entries" ON queue_entries;
DROP POLICY IF EXISTS "Authenticated users can update queue_entries" ON queue_entries;
DROP POLICY IF EXISTS "Authenticated users can delete queue_entries" ON queue_entries;

-- All authenticated users can view queue (managers need this)
CREATE POLICY "Authenticated users can view queue_entries"
  ON queue_entries
  FOR SELECT
  TO authenticated
  USING (true);

-- ICs can add themselves, admins/managers can add anyone
CREATE POLICY "Users can insert their own queue entry"
  ON queue_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ic_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

-- Only ADMIN and MANAGER can update queue entries
CREATE POLICY "Only admins and managers can update queue_entries"
  ON queue_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

-- ICs can delete their own entry, admins/managers can delete any
CREATE POLICY "Users can delete their own queue entry"
  ON queue_entries
  FOR DELETE
  TO authenticated
  USING (
    ic_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );