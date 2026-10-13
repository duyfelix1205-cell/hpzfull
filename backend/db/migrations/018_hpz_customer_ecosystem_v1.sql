-- HPZ Customer Ecosystem V1 foundations.
-- Additive-only migration: does not rewrite, delete, move, or backfill existing production rows.
CREATE SCHEMA IF NOT EXISTS aquacare;
CREATE SCHEMA IF NOT EXISTS community;

CREATE TABLE IF NOT EXISTS aquacare.tank (
  tank_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL,
  name text NOT NULL,
  tank_type text NOT NULL DEFAULT 'AQUARIUM',
  length_cm numeric(10,2),
  width_cm numeric(10,2),
  height_cm numeric(10,2),
  estimated_volume_l numeric(12,2) NOT NULL CHECK (estimated_volume_l > 0),
  filter_type text,
  has_air boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_aquacare_tank_customer ON aquacare.tank(customer_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS aquacare.tank_item (
  tank_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id uuid NOT NULL REFERENCES aquacare.tank(tank_id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'FISH' CHECK (item_type IN ('FISH','EQUIPMENT','PLANT','OTHER')),
  species_id text,
  product_id text,
  species_name text,
  product_name text,
  source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('HPZ_ORDER','MANUAL','OTHER_STORE')),
  source_order_id text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  added_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_aquacare_tank_item_tank ON aquacare.tank_item(tank_id,removed_at,added_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_aquacare_order_item_once
  ON aquacare.tank_item(source_order_id,product_id)
  WHERE source='HPZ_ORDER' AND source_order_id IS NOT NULL AND product_id IS NOT NULL AND removed_at IS NULL;

CREATE TABLE IF NOT EXISTS aquacare.care_log (
  log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id uuid NOT NULL REFERENCES aquacare.tank(tank_id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  water_state text NOT NULL DEFAULT 'unknown' CHECK (water_state IN ('clear','cloudy','green','unknown')),
  filter_state text NOT NULL DEFAULT 'ok' CHECK (filter_state IN ('ok','weak','off','unknown')),
  temperature_c numeric(5,2),
  ph numeric(5,2),
  nh3_nh4_mg_l numeric(12,4),
  no2_mg_l numeric(12,4),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_aquacare_log_tank ON aquacare.care_log(tank_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ix_aquacare_log_customer ON aquacare.care_log(customer_id,created_at DESC);

CREATE TABLE IF NOT EXISTS aquacare.issue (
  issue_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id uuid NOT NULL REFERENCES aquacare.tank(tank_id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  issue_type text NOT NULL CHECK (issue_type IN ('gasp','spots','fin','eating','water','filter','death','other')),
  affected_tank_item_id uuid REFERENCES aquacare.tank_item(tank_item_id) ON DELETE SET NULL,
  affected_species_name text,
  affected_count integer NOT NULL DEFAULT 0 CHECK (affected_count >= 0),
  onset text NOT NULL DEFAULT 'Không rõ',
  description text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_aquacare_issue_tank ON aquacare.issue(tank_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS ix_aquacare_issue_customer ON aquacare.issue(customer_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS aquacare.reminder (
  reminder_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id uuid NOT NULL REFERENCES aquacare.tank(tank_id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  title text NOT NULL,
  due_at timestamptz,
  recurrence text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','DONE','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_aquacare_reminder_customer ON aquacare.reminder(customer_id,status,due_at);

CREATE TABLE IF NOT EXISTS community.post (
  post_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL REFERENCES customer_accounts(account_id) ON DELETE RESTRICT,
  customer_id text NOT NULL,
  author_display_name text NOT NULL,
  post_type text NOT NULL DEFAULT 'TEXT' CHECK (post_type IN ('TEXT','TANK','WIKI','MARKET')),
  title text,
  body text NOT NULL,
  target_type text,
  target_id text,
  status text NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED','HIDDEN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_community_post_public ON community.post(status,created_at DESC);
CREATE INDEX IF NOT EXISTS ix_community_post_customer ON community.post(customer_id,created_at DESC);

CREATE TABLE IF NOT EXISTS community.comment (
  comment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community.post(post_id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES customer_accounts(account_id) ON DELETE RESTRICT,
  customer_id text NOT NULL,
  author_display_name text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED','HIDDEN')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_community_comment_post ON community.comment(post_id,status,created_at);

CREATE TABLE IF NOT EXISTS community.reaction (
  post_id uuid NOT NULL REFERENCES community.post(post_id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES customer_accounts(account_id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  reaction_type text NOT NULL DEFAULT 'LIKE' CHECK (reaction_type IN ('LIKE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(post_id,account_id,reaction_type)
);
CREATE INDEX IF NOT EXISTS ix_community_reaction_post ON community.reaction(post_id,reaction_type);
