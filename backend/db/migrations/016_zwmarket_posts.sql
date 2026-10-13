-- Public ZWMarket marketplace model.
-- Additive-only: no existing Catalog rows are updated, deleted, merged or backfilled.
CREATE TABLE IF NOT EXISTS catalog_market_post (
  post_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Khác',
  description text NOT NULL DEFAULT '',
  price_amount numeric(14,2),
  price_text text,
  currency text NOT NULL DEFAULT 'VND',
  location_text text,
  seller_display_name text NOT NULL DEFAULT '',
  seller_contact text,
  seller_avatar_url text,
  seller_verified boolean NOT NULL DEFAULT false,
  author_user_id text,
  submission_source text NOT NULL DEFAULT 'ADMIN' CHECK (submission_source IN ('ADMIN','USER','PARTNER','IMPORT')),
  moderation_status text NOT NULL DEFAULT 'PENDING' CHECK (moderation_status IN ('PENDING','APPROVED','REJECTED')),
  publish_status text NOT NULL DEFAULT 'DRAFT' CHECK (publish_status IN ('DRAFT','PUBLISHED','HIDDEN')),
  featured boolean NOT NULL DEFAULT false,
  is_sold boolean NOT NULL DEFAULT false,
  allow_shipping boolean NOT NULL DEFAULT false,
  warranty_text text,
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_catalog_market_post_public
  ON catalog_market_post(publish_status, moderation_status, featured, published_at DESC);
CREATE INDEX IF NOT EXISTS ix_catalog_market_post_author
  ON catalog_market_post(author_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_catalog_market_post_category
  ON catalog_market_post(category, published_at DESC);
