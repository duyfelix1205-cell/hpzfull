-- Remove only the legacy fake review seed rows that were originally shipped by code.
-- Preserve every customized review and every other homepage setting.

UPDATE catalog_site_setting
SET value_json = jsonb_set(
  value_json,
  '{reviews,items}',
  COALESCE(
    (
      SELECT jsonb_agg(item ORDER BY ord)
      FROM jsonb_array_elements(COALESCE(value_json #> '{reviews,items}', '[]'::jsonb))
           WITH ORDINALITY AS review(item, ord)
      WHERE NOT (
        item->>'name' = 'Khách hàng HPZ'
        AND item->>'text' IN (
          'Giao hàng cẩn thận, cá không sốc nước. Recommend.',
          'Giá hợp lý, anh chủ rành cá thật. Mua ủng hộ lần 2 rồi.',
          'Cá betta đẹp xuất sắc, màu rực. Đóng gói kỹ.',
          'Tư vấn bể, lọc nhiệt tình dù mình mua ít. Quý thật.'
        )
      )
    ),
    '[]'::jsonb
  ),
  true
),
updated_at = now()
WHERE setting_key = 'homepage'
  AND jsonb_typeof(COALESCE(value_json #> '{reviews,items}', '[]'::jsonb)) = 'array';
