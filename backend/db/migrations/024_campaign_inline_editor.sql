CREATE TABLE IF NOT EXISTS catalog_campaign_editor_access (
  username text PRIMARY KEY,
  password_sha256 text NOT NULL CHECK (password_sha256 ~ '^[0-9a-f]{64}$'),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO catalog_campaign_editor_access(username,password_sha256,active)
VALUES ('admin','8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',true)
ON CONFLICT (username) DO UPDATE
SET password_sha256=EXCLUDED.password_sha256,
    active=true,
    updated_at=now();

CREATE TABLE IF NOT EXISTS catalog_campaign_content (
  campaign_key text PRIMARY KEY,
  copy_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO catalog_campaign_content(campaign_key,copy_json)
VALUES ('mi-an-longfin','{}'::jsonb)
ON CONFLICT (campaign_key) DO NOTHING;
