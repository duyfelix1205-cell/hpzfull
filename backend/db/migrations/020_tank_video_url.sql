-- ISS-2026-0046: allow tank detail pages to display a real product video.
-- Additive only: existing tank rows and media remain untouched.
ALTER TABLE catalog_tank
  ADD COLUMN IF NOT EXISTS video_url text;
