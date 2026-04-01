/*
  # Clinical Admissions Dispatcher Schema

  1. New Tables
    - `users` - Staff roster with roles and tier ranks
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `role` (text: Admin, Manager, IC)
      - `tier_rank` (integer: 1 is best, 3 is lowest)
      - `status` (text: Busy, Available, In-Queue)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `queue` - ICs waiting for reassignment
      - `id` (uuid, primary key)
      - `ic_email` (text, foreign key to users)
      - `tier_rank` (integer, cached for sorting)
      - `timestamp_entered` (timestamp)
      - `created_at` (timestamp)
    
    - `bps_slots` - Available BPS appointments
      - `id` (uuid, primary key)
      - `patient_id` (text, unique)
      - `start_time` (timestamp)
      - `status` (text: Open, Assigned)
      - `assigned_ic` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Create policies for public access (V1 prototype)
    - No authentication required for initial prototype
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('Admin', 'Manager', 'IC')),
  tier_rank integer CHECK (tier_rank >= 1 AND tier_rank <= 3),
  status text NOT NULL DEFAULT 'Available' CHECK (status IN ('Busy', 'Available', 'In-Queue')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ic_email text NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  tier_rank integer NOT NULL,
  timestamp_entered timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bps_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text UNIQUE NOT NULL,
  start_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Assigned')),
  assigned_ic text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE bps_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on users"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on users"
  ON users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on users"
  ON users FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on users"
  ON users FOR DELETE
  USING (true);

CREATE POLICY "Allow public read on queue"
  ON queue FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on queue"
  ON queue FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on queue"
  ON queue FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on queue"
  ON queue FOR DELETE
  USING (true);

CREATE POLICY "Allow public read on bps_slots"
  ON bps_slots FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on bps_slots"
  ON bps_slots FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on bps_slots"
  ON bps_slots FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on bps_slots"
  ON bps_slots FOR DELETE
  USING (true);
