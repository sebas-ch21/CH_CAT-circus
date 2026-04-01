/*
  # Add App Settings Table

  1. New Tables
    - `app_settings`
      - `setting_key` (text, primary key) - The unique identifier for each setting
      - `setting_value` (text) - The value associated with the setting
      - `created_at` (timestamptz) - Timestamp when the setting was created
      - `updated_at` (timestamptz) - Timestamp when the setting was last updated

  2. Initial Data
    - Insert default access PIN setting with key 'access_pin' and value 'charlie2026'

  3. Security
    - Enable RLS on `app_settings` table
    - Add policy for authenticated users to read settings
    - Add policy for authenticated users to update settings
*/

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key text PRIMARY KEY,
  setting_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update settings"
  ON app_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('access_pin', 'charlie2026')
ON CONFLICT (setting_key) DO NOTHING;