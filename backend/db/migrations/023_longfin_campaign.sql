INSERT INTO catalog_content_taxonomy_option(scope,option_value,label,sort_order,locked)
VALUES ('JOURNAL_TYPE','CAMPAIGN','Chiến dịch',5,false)
ON CONFLICT(scope,option_value) DO NOTHING;

INSERT INTO catalog_journal_entry(
  entry_type,title,slug,summary,content,image_url,cta_label,cta_url,publish_status,featured,sort_order
)
VALUES (
  'CAMPAIGN',
  'Mi Ấn Longfin — After Dark',
  'mi-an-longfin',
  'Campaign Experience đầu tiên của Nhật Báo HPZ: khám phá Mi Ấn Longfin qua hình ảnh thật, storytelling và chuyển động riêng.',
  'Mi Ấn Longfin là Campaign Experience thuộc HPZ Catalog. Trải nghiệm giới thiệu dòng cá và hành trình campaign; giá, preorder, thanh toán, batch, policy và trạng thái giao dịch chỉ được sử dụng khi có Source of Truth được HPZ xác nhận.',
  '/campaigns/mi-an-longfin/hero.png',
  'Mở Campaign Experience',
  '/nhat-bao/mi-an-longfin/experience',
  'PUBLISHED',
  true,
  -10
)
ON CONFLICT(slug) DO NOTHING;
