ALTER TABLE catalog_journal_entry
  DROP CONSTRAINT IF EXISTS catalog_journal_entry_entry_type_check;

CREATE TABLE IF NOT EXISTS catalog_content_taxonomy_option (
  option_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('JOURNAL_TYPE','WIKI_CATEGORY')),
  option_value text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  locked boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scope,option_value)
);

CREATE INDEX IF NOT EXISTS ix_catalog_content_taxonomy_scope
  ON catalog_content_taxonomy_option(scope,active,sort_order,label);

INSERT INTO catalog_content_taxonomy_option(scope,option_value,label,sort_order,locked)
VALUES
  ('JOURNAL_TYPE','POSTER','Poster',10,false),
  ('JOURNAL_TYPE','EVENT','Sự kiện',20,false),
  ('JOURNAL_TYPE','OFFER','Ưu đãi',30,false),
  ('JOURNAL_TYPE','ANNOUNCEMENT','Thông báo',40,true)
ON CONFLICT(scope,option_value) DO NOTHING;

INSERT INTO catalog_content_taxonomy_option(scope,option_value,label,sort_order,locked)
VALUES ('WIKI_CATEGORY','Kiến thức chung','Kiến thức chung',10,true)
ON CONFLICT(scope,option_value) DO NOTHING;

INSERT INTO catalog_content_taxonomy_option(scope,option_value,label,sort_order,locked)
SELECT 'JOURNAL_TYPE',entry_type,entry_type,100,false
FROM catalog_journal_entry
WHERE COALESCE(trim(entry_type),'')<>''
GROUP BY entry_type
ON CONFLICT(scope,option_value) DO NOTHING;

INSERT INTO catalog_content_taxonomy_option(scope,option_value,label,sort_order,locked)
SELECT 'WIKI_CATEGORY',category,category,100,false
FROM catalog_wiki_article
WHERE COALESCE(trim(category),'')<>''
GROUP BY category
ON CONFLICT(scope,option_value) DO NOTHING;
