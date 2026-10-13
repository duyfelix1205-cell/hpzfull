ALTER TABLE catalog_media ADD COLUMN IF NOT EXISTS original_name text;
ALTER TABLE catalog_media ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE catalog_media ADD COLUMN IF NOT EXISTS file_size bigint;
ALTER TABLE catalog_media ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS ix_catalog_media_product_sort ON catalog_media(product_id,sort_order,created_at);
