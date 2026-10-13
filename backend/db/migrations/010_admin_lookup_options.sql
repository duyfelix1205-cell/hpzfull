CREATE TABLE IF NOT EXISTS catalog_lookup_option (
  option_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key text NOT NULL,
  value text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  system_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(field_key, value)
);

CREATE INDEX IF NOT EXISTS ix_catalog_lookup_option_field ON catalog_lookup_option(field_key, sort_order, lower(label));

-- Business-editable dropdowns: seed from all values already in production data.
INSERT INTO catalog_lookup_option(field_key,value,label,sort_order)
SELECT 'origin', origin, origin, row_number() OVER (ORDER BY lower(origin))::int
FROM (SELECT DISTINCT trim(origin) origin FROM catalog_content WHERE nullif(trim(origin),'') IS NOT NULL) x
ON CONFLICT(field_key,value) DO NOTHING;

INSERT INTO catalog_lookup_option(field_key,value,label,sort_order)
SELECT 'sale_status', sale_status, sale_status, row_number() OVER (ORDER BY lower(sale_status))::int
FROM (SELECT DISTINCT trim(sale_status) sale_status FROM catalog_product_source WHERE nullif(trim(sale_status),'') IS NOT NULL) x
ON CONFLICT(field_key,value) DO NOTHING;

INSERT INTO catalog_lookup_option(field_key,value,label,sort_order,system_locked) VALUES
 ('sale_status','ACTIVE','ACTIVE',0,false),
 ('stock_display_mode','HIDDEN','HIDDEN',0,true),
 ('stock_display_mode','STATUS_ONLY','STATUS_ONLY',1,true),
 ('stock_display_mode','EXACT','EXACT',2,true),
 ('stock_display_mode','LOW_STOCK','LOW_STOCK',3,true),
 ('tank_publish_status','DRAFT','DRAFT',0,true),
 ('tank_publish_status','PUBLISHED','PUBLISHED',1,true),
 ('tank_publish_status','HIDDEN','HIDDEN',2,true),
 ('tank_publish_status','ARCHIVED','ARCHIVED',3,true)
ON CONFLICT(field_key,value) DO NOTHING;
