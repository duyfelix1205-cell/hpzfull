CREATE TABLE IF NOT EXISTS catalog_journal_entry (
  journal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text NOT NULL DEFAULT 'ANNOUNCEMENT' CHECK (entry_type IN ('POSTER','EVENT','OFFER','ANNOUNCEMENT')),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  summary text,
  content text,
  image_url text,
  cta_label text,
  cta_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  publish_status text NOT NULL DEFAULT 'DRAFT' CHECK (publish_status IN ('DRAFT','PUBLISHED','HIDDEN','ARCHIVED')),
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_catalog_journal_publish ON catalog_journal_entry(publish_status,featured,sort_order,starts_at);

CREATE TABLE IF NOT EXISTS catalog_wiki_article (
  article_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'Kiến thức chung',
  summary text,
  content text,
  image_url text,
  publish_status text NOT NULL DEFAULT 'DRAFT' CHECK (publish_status IN ('DRAFT','PUBLISHED','HIDDEN','ARCHIVED')),
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_catalog_wiki_publish ON catalog_wiki_article(publish_status,category,featured,sort_order);

CREATE TABLE IF NOT EXISTS catalog_link_click_daily (
  event_date date NOT NULL,
  source_path text NOT NULL,
  target_path text NOT NULL,
  link_label text NOT NULL DEFAULT '',
  click_count bigint NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(event_date,source_path,target_path,link_label)
);
CREATE INDEX IF NOT EXISTS ix_catalog_link_click_daily_date ON catalog_link_click_daily(event_date DESC);
CREATE INDEX IF NOT EXISTS ix_catalog_link_click_daily_target ON catalog_link_click_daily(target_path,event_date DESC);
