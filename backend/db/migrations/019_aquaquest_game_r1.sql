-- HPZ AquaQuest Game R1.
-- Additive-only migration. Game state is isolated in its own schema and does not rewrite Catalog/AquaCare/customer production rows.
CREATE SCHEMA IF NOT EXISTS game;

CREATE TABLE IF NOT EXISTS game.player (
  account_id text PRIMARY KEY REFERENCES customer_accounts(account_id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1 CHECK (level > 0),
  xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  aqua_coin integer NOT NULL DEFAULT 250 CHECK (aqua_coin >= 0),
  reputation integer NOT NULL DEFAULT 0 CHECK (reputation >= 0),
  streak_days integer NOT NULL DEFAULT 1 CHECK (streak_days > 0),
  last_login_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game.inventory (
  account_id text NOT NULL REFERENCES customer_accounts(account_id) ON DELETE CASCADE,
  item_code text NOT NULL,
  item_name text NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('CROP','ANIMAL','BAIT','FEED','DECOR','OTHER')),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  metadata_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,item_code)
);

CREATE TABLE IF NOT EXISTS game.aquarium (
  aquarium_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL REFERENCES customer_accounts(account_id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Bể cá phòng khách',
  capacity integer NOT NULL DEFAULT 12 CHECK (capacity BETWEEN 1 AND 200),
  cleanliness integer NOT NULL DEFAULT 82 CHECK (cleanliness BETWEEN 0 AND 100),
  oxygen integer NOT NULL DEFAULT 86 CHECK (oxygen BETWEEN 0 AND 100),
  temperature_c numeric(5,2) NOT NULL DEFAULT 25.5,
  beauty integer NOT NULL DEFAULT 45 CHECK (beauty BETWEEN 0 AND 100),
  last_fed_at timestamptz,
  last_cleaned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_game_default_aquarium ON game.aquarium(account_id);

CREATE TABLE IF NOT EXISTS game.fish (
  fish_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL REFERENCES customer_accounts(account_id) ON DELETE CASCADE,
  aquarium_id uuid REFERENCES game.aquarium(aquarium_id) ON DELETE SET NULL,
  product_id text,
  fish_name text NOT NULL,
  source text NOT NULL CHECK (source IN ('CAUGHT','PURCHASED','REWARD')),
  rarity text NOT NULL DEFAULT 'COMMON' CHECK (rarity IN ('COMMON','UNCOMMON','RARE','EPIC')),
  health integer NOT NULL DEFAULT 90 CHECK (health BETWEEN 0 AND 100),
  hunger integer NOT NULL DEFAULT 72 CHECK (hunger BETWEEN 0 AND 100),
  happiness integer NOT NULL DEFAULT 75 CHECK (happiness BETWEEN 0 AND 100),
  size_cm numeric(7,2) NOT NULL DEFAULT 3 CHECK (size_cm > 0),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_game_fish_account ON game.fish(account_id,aquarium_id,acquired_at DESC);

CREATE TABLE IF NOT EXISTS game.daily_progress (
  account_id text NOT NULL REFERENCES customer_accounts(account_id) ON DELETE CASCADE,
  game_date date NOT NULL,
  action_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_claimed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,game_date)
);

CREATE TABLE IF NOT EXISTS game.activity (
  activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL REFERENCES customer_accounts(account_id) ON DELETE CASCADE,
  action_type text NOT NULL,
  detail_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_game_activity_account ON game.activity(account_id,created_at DESC);
