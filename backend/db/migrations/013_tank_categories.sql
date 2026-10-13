-- ISS-2026-0027
-- Additive-only migration. Existing tank/product data is not modified or deleted.
CREATE TABLE IF NOT EXISTS catalog_tank_category (
  category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_tank_category_map (
  tank_id text NOT NULL REFERENCES catalog_tank(tank_id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES catalog_tank_category(category_id) ON DELETE CASCADE,
  PRIMARY KEY (tank_id, category_id)
);

CREATE INDEX IF NOT EXISTS ix_catalog_tank_category_map_tank ON catalog_tank_category_map(tank_id);
CREATE INDEX IF NOT EXISTS ix_catalog_tank_category_map_category ON catalog_tank_category_map(category_id);
