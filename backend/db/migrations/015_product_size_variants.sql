-- ISS-2026-0033
-- Additive-only size pricing model. Existing product/source/content rows are not changed or merged.
CREATE TABLE IF NOT EXISTS catalog_product_size_variant (
  variant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES catalog_product_source(product_id) ON DELETE CASCADE,
  size_label text NOT NULL,
  list_price numeric(14,2),
  price_text text,
  combo_prices_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  combo_prices_text_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  available_qty numeric,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_product_size_variant_label
  ON catalog_product_size_variant(product_id, lower(size_label));
CREATE INDEX IF NOT EXISTS ix_catalog_product_size_variant_product
  ON catalog_product_size_variant(product_id, is_active, sort_order);
