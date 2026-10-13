ALTER TABLE catalog_product_source ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'ORDERS';
ALTER TABLE catalog_product_source ADD COLUMN IF NOT EXISTS price_text text;
ALTER TABLE catalog_product_source ADD COLUMN IF NOT EXISTS combo_prices_text_json jsonb;
ALTER TABLE catalog_product_source ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'FISH';
ALTER TABLE catalog_product_source DROP CONSTRAINT IF EXISTS catalog_product_source_product_type_check;
ALTER TABLE catalog_product_source ADD CONSTRAINT catalog_product_source_product_type_check CHECK (product_type IN ('FISH'));

CREATE TABLE IF NOT EXISTS catalog_tank (
  tank_id text PRIMARY KEY CHECK (tank_id ~ '^TNK-[A-Za-z0-9._-]+$'),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  description text,
  size_text text,
  glass_text text,
  included_text text,
  price numeric(14,2),
  price_text text,
  publish_status text NOT NULL DEFAULT 'DRAFT' CHECK (publish_status IN ('DRAFT','PUBLISHED','HIDDEN','ARCHIVED')),
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_tank_media (
  media_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id text NOT NULL REFERENCES catalog_tank(tank_id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  original_name text,
  mime_type text,
  file_size bigint,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_tank_media_primary ON catalog_tank_media(tank_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS ix_catalog_tank_publish ON catalog_tank(publish_status,featured,sort_order);
CREATE INDEX IF NOT EXISTS ix_catalog_source_kind ON catalog_product_source(source_kind,product_type);

UPDATE catalog_product_source SET source_kind='ORDERS' WHERE source_kind IS NULL OR source_kind='';
