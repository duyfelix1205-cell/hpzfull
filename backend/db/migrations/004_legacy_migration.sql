ALTER TABLE catalog_legacy_mapping ADD COLUMN IF NOT EXISTS legacy_payload jsonb;
ALTER TABLE catalog_legacy_mapping ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE catalog_legacy_mapping ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE catalog_media ADD COLUMN IF NOT EXISTS legacy_source_path text;
CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_media_legacy_source
  ON catalog_media(product_id,legacy_source_path) WHERE legacy_source_path IS NOT NULL;

CREATE TABLE IF NOT EXISTS catalog_legacy_import_run (
  import_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  dry_run boolean NOT NULL DEFAULT true,
  matched_count integer NOT NULL DEFAULT 0,
  imported_content_count integer NOT NULL DEFAULT 0,
  imported_media_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'RUNNING',
  error_summary text
);
