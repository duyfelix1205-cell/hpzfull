CREATE OR REPLACE FUNCTION ensure_catalog_content_for_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO catalog_content(product_id) VALUES(NEW.product_id)
  ON CONFLICT(product_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_catalog_source_content ON catalog_product_source;
CREATE TRIGGER trg_catalog_source_content
AFTER INSERT ON catalog_product_source
FOR EACH ROW EXECUTE FUNCTION ensure_catalog_content_for_source();
