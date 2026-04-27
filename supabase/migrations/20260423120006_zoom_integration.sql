/*
  # Zoom Integration (Feature 3)

  Programmatic Zoom-meeting creation with two modes:
    - user  : meetings hosted on the target manager's Zoom user account
    - rooms : meetings booked inside a Zoom Room resource
    - auto  : try `user`, fall back to `rooms` when quota would overflow

  All modes coexist with the existing manual-paste fallback in
  `ZoomLinkModal.jsx`; the "Generate" button is additive so any
  failure path degrades to the current UX rather than a broken modal.
*/

-- ============================================================
-- 1. PROFILE + SLOT ADDITIONS
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS zoom_user_id text;

ALTER TABLE public.bps_slots
  ADD COLUMN IF NOT EXISTS zoom_meeting_id text,
  ADD COLUMN IF NOT EXISTS zoom_host_id    text,
  -- Discriminator so we can reason about where a given link came from.
  ADD COLUMN IF NOT EXISTS zoom_source     text
    CHECK (zoom_source IN ('manual','user','room'));

-- ============================================================
-- 2. USAGE QUOTA TRACKING
-- ============================================================
CREATE TABLE IF NOT EXISTS public.zoom_usage (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  zoom_user_id      text NOT NULL,
  day_bucket        date NOT NULL,
  meetings_created  int DEFAULT 0 NOT NULL,
  concurrent_peak   int DEFAULT 0 NOT NULL,
  UNIQUE(zoom_user_id, day_bucket)
);

CREATE INDEX IF NOT EXISTS idx_zoom_usage_day ON public.zoom_usage(day_bucket);

-- ============================================================
-- 3. ROOMS INVENTORY (mode = rooms/auto)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.zoom_rooms (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  zoom_room_id  text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  capacity      int,
  active        boolean DEFAULT true NOT NULL,
  -- Used by the scheduling heuristic to prefer least-recently-used rooms.
  last_booked_at timestamptz
);

-- ============================================================
-- 4. REQUEST LOG (idempotency)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.zoom_request_log (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_request_id text UNIQUE NOT NULL,
  slot_id           uuid REFERENCES public.bps_slots(id) ON DELETE SET NULL,
  host_id           text,
  response          jsonb DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','success','failed')),
  created_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_zoom_request_log_slot ON public.zoom_request_log(slot_id);

-- ============================================================
-- 5. MODE SETTING
-- ============================================================
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES ('zoom_mode', 'auto')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 6. RLS
-- ============================================================
ALTER TABLE public.zoom_usage       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_rooms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_request_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zoom_usage_all" ON public.zoom_usage;
CREATE POLICY "zoom_usage_all" ON public.zoom_usage FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "zoom_rooms_all" ON public.zoom_rooms;
CREATE POLICY "zoom_rooms_all" ON public.zoom_rooms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "zoom_req_all" ON public.zoom_request_log;
CREATE POLICY "zoom_req_all" ON public.zoom_request_log FOR ALL USING (true) WITH CHECK (true);
