# M4 — Media Upload / Gallery

Implemented on top of the isolated Product Catalog application.

## Ownership
Catalog owns media files and media metadata. CRM Orders is not modified and is never queried directly at DB level.

## Storage
- local/Compose: named volume `catalog_media` mounted at `/app/uploads`
- K3s: existing PVC `catalog-media` mounted at `/app/uploads`
- database stores only relative `storage_key` plus metadata

## Admin API
- `GET /api/v1/admin/catalog/products/:productId/media`
- `POST /api/v1/admin/catalog/products/:productId/media` (`multipart/form-data`, field `file`)
- `PATCH /api/v1/admin/catalog/products/:productId/media/:mediaId`
- `PUT /api/v1/admin/catalog/products/:productId/media/reorder`
- `DELETE /api/v1/admin/catalog/products/:productId/media/:mediaId`

Supported image types: JPEG, PNG, WEBP, GIF. Default max size: 8 MiB.

## Public API
Product list includes `primary_image_url`; product detail includes ordered `media[]`.
