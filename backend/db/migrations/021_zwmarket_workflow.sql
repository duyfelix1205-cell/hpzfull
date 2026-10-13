-- ZWMarket authenticated seller workflow, moderation metadata and market sessions.
-- Additive-only: existing posts are preserved; no production rows are rewritten or reseeded.
ALTER TABLE catalog_market_post
  ADD COLUMN IF NOT EXISTS contact_public boolean NOT NULL DEFAULT false;
ALTER TABLE catalog_market_post
  ADD COLUMN IF NOT EXISTS moderation_note text;

CREATE TABLE IF NOT EXISTS catalog_market_session (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','UPCOMING','OPEN','ENDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_catalog_market_session_public
  ON catalog_market_session(status,starts_at,ends_at);

CREATE TABLE IF NOT EXISTS catalog_market_session_post (
  session_id uuid NOT NULL REFERENCES catalog_market_session(session_id) ON DELETE RESTRICT,
  post_id uuid NOT NULL REFERENCES catalog_market_post(post_id) ON DELETE RESTRICT,
  joined_by_account_id text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  PRIMARY KEY(session_id,post_id)
);

CREATE INDEX IF NOT EXISTS ix_catalog_market_session_post_post
  ON catalog_market_session_post(post_id,joined_at DESC);
CREATE INDEX IF NOT EXISTS ix_catalog_market_session_post_active
  ON catalog_market_session_post(session_id,joined_at DESC)
  WHERE removed_at IS NULL;
