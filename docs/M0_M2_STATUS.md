# M0–M2 status

## M0
- Legacy upstream repo: `LightZex/hpz-aquaroom`.
- Verified legacy main SHA: `865168e0933c72bc0e390a9c1fe694f00a24b7ff`.
- Canonical Product Catalog repo: `tranhung204/nexora-product-catalog`.
- Canonical repo initial SHA: `75566cb3c62a8104fa19d7b224f9f9cc4a56d290`.
- ZIP remains legacy reference/migration input only.

## M1 implemented
- React frontend skeleton.
- Node/Express backend.
- PostgreSQL schema + migrations.
- Dockerfiles + docker-compose.
- K3s namespace, storage, PostgreSQL, backend/frontend deployments, health probes.
- CI skeleton.
- `/health/live`, `/health/ready`.

## M2 implemented
- Catalog source/content/media/category/sync/migration tables.
- `INT-ORD-CAT-001` consumer contract draft.
- Fixture adapter + HTTP adapter.
- Manual sync + sync status API.
- Configurable periodic sync scheduler.
- Idempotent upsert by canonical `product_id`.
- Durable sync run/error history, including producer failures.
- Public minimal read API foundation.

## Current blocker
- CRM Orders producer endpoint `GET /api/v1/integration/catalog/products` does not yet exist. Catalog remains on `ORDERS_ADAPTER=fixture` until that producer contract is implemented and verified.
