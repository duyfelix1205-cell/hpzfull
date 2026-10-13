CREATE TABLE IF NOT EXISTS catalog_admin_access (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  password_sha256 text NOT NULL CHECK (password_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO catalog_admin_access(singleton,password_sha256)
VALUES (true,'8c698867260784062548b44d5ae2c3deae5e159b0445fdb64a73d3c270df3de2')
ON CONFLICT (singleton) DO NOTHING;
