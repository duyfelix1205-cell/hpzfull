CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS catalog_product_source (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL UNIQUE CHECK (product_id ~ '^PRD-[A-Za-z0-9._-]+$'),
  product_name text NOT NULL,
  sale_status text NOT NULL DEFAULT 'UNKNOWN',
  available_qty numeric,
  list_price numeric(14,2),
  combo_prices_json jsonb,
  product_code text,
  branch_availability_json jsonb,
  source_updated_at timestamptz,
  inventory_updated_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  sync_state text NOT NULL DEFAULT 'OK',
  sync_error text
);

CREATE TABLE IF NOT EXISTS catalog_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL UNIQUE REFERENCES catalog_product_source(product_id) ON DELETE CASCADE,
  slug text UNIQUE,
  secondary_name text,
  short_description text,
  description text,
  origin text,
  size_text text,
  temperament text,
  care_info text,
  selling_points_json jsonb,
  video_url text,
  publish_status text NOT NULL DEFAULT 'DRAFT' CHECK (publish_status IN ('DRAFT','PUBLISHED','HIDDEN','ARCHIVED')),
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  stock_display_mode text NOT NULL DEFAULT 'EXACT' CHECK (stock_display_mode IN ('EXACT','STATUS_ONLY','LOW_STOCK','HIDDEN')),
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_media (
  media_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES catalog_product_source(product_id) ON DELETE CASCADE,
  media_type text NOT NULL DEFAULT 'IMAGE' CHECK (media_type IN ('IMAGE','VIDEO_FILE')),
  storage_key text NOT NULL,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_media_primary ON catalog_media(product_id) WHERE is_primary;

CREATE TABLE IF NOT EXISTS catalog_category (
  category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE',
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS catalog_product_category (
  product_id text NOT NULL REFERENCES catalog_product_source(product_id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES catalog_category(category_id) ON DELETE CASCADE,
  PRIMARY KEY(product_id, category_id)
);

CREATE TABLE IF NOT EXISTS catalog_sync_run (
  sync_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL,
  fetched_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error_summary text,
  source_cursor text
);

CREATE TABLE IF NOT EXISTS catalog_sync_error (
  id bigserial PRIMARY KEY,
  sync_run_id uuid NOT NULL REFERENCES catalog_sync_run(sync_run_id) ON DELETE CASCADE,
  product_id text,
  error_message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_legacy_mapping (
  legacy_key text PRIMARY KEY,
  legacy_vn_name text,
  legacy_en_name text,
  proposed_product_id text,
  match_type text,
  match_status text NOT NULL DEFAULT 'UNMATCHED' CHECK (match_status IN ('MATCHED','UNMATCHED','REVIEW_REQUIRED')),
  confidence numeric(5,4),
  manually_confirmed boolean NOT NULL DEFAULT false,
  imported_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_catalog_source_name ON catalog_product_source(lower(product_name));
CREATE INDEX IF NOT EXISTS ix_catalog_source_synced_at ON catalog_product_source(synced_at DESC);
CREATE INDEX IF NOT EXISTS ix_catalog_content_publish ON catalog_content(publish_status,featured,sort_order);
