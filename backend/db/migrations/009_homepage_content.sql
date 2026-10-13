CREATE TABLE IF NOT EXISTS catalog_site_setting (
  setting_key text PRIMARY KEY,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO catalog_site_setting(setting_key,value_json)
VALUES ('homepage','{}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
