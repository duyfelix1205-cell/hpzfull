-- ISS-2026-0100/0101: ZWMarket hidden-action context and sold visibility window.
-- Additive-only: no existing rows are updated, deleted, reseeded or reclassified.
ALTER TABLE catalog_market_post
  ADD COLUMN IF NOT EXISTS hidden_action text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='ck_catalog_market_post_hidden_action'
       AND conrelid='catalog_market_post'::regclass
  ) THEN
    ALTER TABLE catalog_market_post
      ADD CONSTRAINT ck_catalog_market_post_hidden_action
      CHECK (hidden_action IS NULL OR hidden_action IN ('EDIT_RESUBMIT','CONTACT_HPZ','VIEW_ONLY'));
  END IF;
END $$;

ALTER TABLE catalog_market_post
  ADD COLUMN IF NOT EXISTS sold_at timestamptz;
ALTER TABLE catalog_market_post
  ADD COLUMN IF NOT EXISTS sold_visibility_until timestamptz;

CREATE INDEX IF NOT EXISTS ix_catalog_market_post_visibility
  ON catalog_market_post(publish_status,moderation_status,is_sold,sold_visibility_until,published_at DESC);
