CREATE TABLE IF NOT EXISTS catalog_admin_audit (
  audit_id bigserial PRIMARY KEY,
  actor_user_id text,
  actor_roles text[] NOT NULL DEFAULT '{}',
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_catalog_admin_audit_created ON catalog_admin_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_catalog_admin_audit_actor ON catalog_admin_audit(actor_user_id,created_at DESC);

ALTER TABLE catalog_category ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE catalog_category DROP CONSTRAINT IF EXISTS catalog_category_status_check;
ALTER TABLE catalog_category ADD CONSTRAINT catalog_category_status_check CHECK (status IN ('ACTIVE','INACTIVE'));
CREATE INDEX IF NOT EXISTS ix_catalog_product_category_category ON catalog_product_category(category_id,product_id);
