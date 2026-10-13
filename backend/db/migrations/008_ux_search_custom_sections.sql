CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE catalog_content
  ADD COLUMN IF NOT EXISTS display_sections_json jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE catalog_tank
  ADD COLUMN IF NOT EXISTS display_sections_json jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS ix_catalog_source_name_trgm
  ON catalog_product_source USING gin (lower(product_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_catalog_content_secondary_trgm
  ON catalog_content USING gin (lower(COALESCE(secondary_name,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_catalog_tank_name_trgm
  ON catalog_tank USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_catalog_media_product_order
  ON catalog_media(product_id,is_primary DESC,sort_order,created_at);
CREATE INDEX IF NOT EXISTS ix_catalog_tank_media_tank_order
  ON catalog_tank_media(tank_id,is_primary DESC,sort_order,created_at);
