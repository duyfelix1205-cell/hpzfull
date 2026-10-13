CREATE TABLE IF NOT EXISTS customer_accounts (
  account_id text PRIMARY KEY,
  email text NOT NULL,
  email_normalized text NOT NULL UNIQUE,
  display_name text,
  password_hash text,
  google_subject text UNIQUE,
  email_verified_at timestamptz,
  phone text,
  phone_normalized text,
  orders_customer_id text,
  orders_link_status text NOT NULL DEFAULT 'NOT_LINKED',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT customer_accounts_login_method_chk CHECK (password_hash IS NOT NULL OR google_subject IS NOT NULL),
  CONSTRAINT customer_accounts_link_status_chk CHECK (orders_link_status IN (
    'NOT_LINKED','LINKED','REVIEW_REQUIRED_NO_CUSTOMER_EMAIL','REVIEW_REQUIRED_EMAIL_MISMATCH','REVIEW_REQUIRED_DUPLICATE_PHONE'
  ))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_accounts_orders_customer
  ON customer_accounts(orders_customer_id) WHERE orders_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_accounts_phone ON customer_accounts(phone_normalized);

CREATE TABLE IF NOT EXISTS customer_sessions (
  session_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES customer_accounts(account_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_account ON customer_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_expiry ON customer_sessions(expires_at);

CREATE TABLE IF NOT EXISTS customer_auth_tokens (
  auth_token_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES customer_accounts(account_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_auth_tokens_purpose_chk CHECK (purpose IN ('VERIFY_EMAIL','RESET_PASSWORD'))
);
CREATE INDEX IF NOT EXISTS idx_customer_auth_tokens_account_purpose
  ON customer_auth_tokens(account_id,purpose,expires_at);
