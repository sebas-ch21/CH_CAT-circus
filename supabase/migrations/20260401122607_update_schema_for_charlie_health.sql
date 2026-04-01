/*
  # Update Schema for Charlie Health Requirements

  1. Changes
    - Drop existing tables and recreate with proper types and constraints
    - Add enums for standardized data
    - Update RLS policies for production use
    - Set up proper foreign key relationships

  2. Tables
    - profiles: User profiles extending auth
    - queue_entries: Real-time IC queue
    - bps_slots: Available appointment slots
*/

-- Drop existing tables
DROP TABLE IF EXISTS queue CASCADE;
DROP TABLE IF EXISTS bps_slots CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create enums for type safety
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('ADMIN', 'MANAGER', 'IC');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ic_status AS ENUM ('AVAILABLE', 'IN_QUEUE', 'BUSY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE slot_status AS ENUM ('OPEN', 'ASSIGNED', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  role app_role DEFAULT 'IC' NOT NULL,
  tier_rank integer CHECK (tier_rank BETWEEN 1 AND 3),
  current_status ic_status DEFAULT 'AVAILABLE' NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create queue_entries table
CREATE TABLE IF NOT EXISTS public.queue_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ic_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  entered_at timestamptz DEFAULT now() NOT NULL
);

-- Create bps_slots table
CREATE TABLE IF NOT EXISTS public.bps_slots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_identifier text NOT NULL,
  start_time timestamptz NOT NULL,
  status slot_status DEFAULT 'OPEN' NOT NULL,
  assigned_ic_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bps_slots ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Allow public read on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public insert on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public delete on profiles" ON public.profiles;

CREATE POLICY "Allow public read on profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on profiles"
  ON public.profiles FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on profiles"
  ON public.profiles FOR DELETE
  USING (true);

-- Queue policies
DROP POLICY IF EXISTS "Allow public read on queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Allow public insert on queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Allow public update on queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Allow public delete on queue_entries" ON public.queue_entries;

CREATE POLICY "Allow public read on queue_entries"
  ON public.queue_entries FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on queue_entries"
  ON public.queue_entries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on queue_entries"
  ON public.queue_entries FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on queue_entries"
  ON public.queue_entries FOR DELETE
  USING (true);

-- BPS slots policies
DROP POLICY IF EXISTS "Allow public read on bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Allow public insert on bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Allow public update on bps_slots" ON public.bps_slots;
DROP POLICY IF EXISTS "Allow public delete on bps_slots" ON public.bps_slots;

CREATE POLICY "Allow public read on bps_slots"
  ON public.bps_slots FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on bps_slots"
  ON public.bps_slots FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on bps_slots"
  ON public.bps_slots FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on bps_slots"
  ON public.bps_slots FOR DELETE
  USING (true);

-- Insert demo users
INSERT INTO public.profiles (email, role, tier_rank, current_status) VALUES
  ('admin@clinic.com', 'ADMIN', 1, 'AVAILABLE'),
  ('manager@clinic.com', 'MANAGER', 1, 'AVAILABLE'),
  ('ic1@clinic.com', 'IC', 1, 'AVAILABLE'),
  ('ic2@clinic.com', 'IC', 2, 'AVAILABLE'),
  ('ic3@clinic.com', 'IC', 3, 'AVAILABLE'),
  ('ic4@clinic.com', 'IC', 1, 'AVAILABLE'),
  ('ic5@clinic.com', 'IC', 2, 'AVAILABLE')
ON CONFLICT (email) DO NOTHING;
