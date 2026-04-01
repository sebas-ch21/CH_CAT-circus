/*
  # Enable RLS with Public Access for Testing

  1. Changes
    - Enable RLS on profiles, queue_entries, and bps_slots tables
    - Add temporary PUBLIC policies for all operations (SELECT, INSERT, UPDATE, DELETE)
    - Ensure admin@clinic.com user exists for login
    
  2. Security Notes
    - These policies allow unrestricted public access for TESTING ONLY
    - Should be replaced with proper role-based policies in production
    - Using 'public' role which includes both authenticated and anon users
    
  3. Tables Affected
    - profiles: Full public access
    - queue_entries: Full public access
    - bps_slots: Full public access
*/

-- ============================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bps_slots ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. DROP EXISTING RESTRICTIVE POLICIES
-- ============================================

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Allow public read on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public insert on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public delete on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins and managers can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;

-- Drop all existing policies on queue_entries
DROP POLICY IF EXISTS "Allow public read on queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Allow public insert on queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Allow public update on queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Allow public delete on queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Authenticated users can view queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Users can insert their own queue entry" ON public.queue_entries;
DROP POLICY IF EXISTS "Only admins and managers can update queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Users can delete their own queue entry" ON public.queue_entries;

-- Drop all existing policies on bps_slots
DROP POLICY IF EXISTS "Allow public read on bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Allow public insert on bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Allow public update on bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Allow public delete on bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Authenticated users can view all bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Only admins can insert bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Admins and managers can update bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Only admins can delete bps_slots" ON public.bps_slots;

-- ============================================
-- 3. CREATE PUBLIC POLICIES FOR TESTING
-- ============================================

-- PROFILES TABLE: Full public access
CREATE POLICY "Public can read profiles"
  ON public.profiles
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert profiles"
  ON public.profiles
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update profiles"
  ON public.profiles
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete profiles"
  ON public.profiles
  FOR DELETE
  TO public
  USING (true);

-- QUEUE_ENTRIES TABLE: Full public access
CREATE POLICY "Public can read queue_entries"
  ON public.queue_entries
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert queue_entries"
  ON public.queue_entries
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update queue_entries"
  ON public.queue_entries
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete queue_entries"
  ON public.queue_entries
  FOR DELETE
  TO public
  USING (true);

-- BPS_SLOTS TABLE: Full public access
CREATE POLICY "Public can read bps_slots"
  ON public.bps_slots
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert bps_slots"
  ON public.bps_slots
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update bps_slots"
  ON public.bps_slots
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete bps_slots"
  ON public.bps_slots
  FOR DELETE
  TO public
  USING (true);

-- ============================================
-- 4. ENSURE ADMIN USER EXISTS
-- ============================================

INSERT INTO public.profiles (email, role, tier_rank, current_status) 
VALUES ('admin@clinic.com', 'ADMIN', 1, 'AVAILABLE')
ON CONFLICT (email) DO UPDATE 
SET role = 'ADMIN', tier_rank = 1, current_status = 'AVAILABLE';

-- Also ensure other demo users exist
INSERT INTO public.profiles (email, role, tier_rank, current_status) VALUES
  ('manager@clinic.com', 'MANAGER', 1, 'AVAILABLE'),
  ('ic1@clinic.com', 'IC', 1, 'AVAILABLE'),
  ('ic2@clinic.com', 'IC', 2, 'AVAILABLE'),
  ('ic3@clinic.com', 'IC', 3, 'AVAILABLE'),
  ('ic4@clinic.com', 'IC', 1, 'AVAILABLE'),
  ('ic5@clinic.com', 'IC', 2, 'AVAILABLE')
ON CONFLICT (email) DO NOTHING;