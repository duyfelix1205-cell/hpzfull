# Temporary standalone catalog mode

Current temporary operating mode for Product Catalog while Orders integration is paused.

## Fish

- Product Catalog owns temporary LOCAL fish records (`source_kind=LOCAL`).
- Admin can create/edit/delete LOCAL fish, prices, combo display prices, content, publish state and gallery.
- The pinned HPZ Aquaroom legacy runtime is seeded idempotently into LOCAL fish records.
- Legacy images are copied into the Catalog media PVC and served from `/media`.
- Existing Orders-owned rows are preserved but hidden from public display while standalone mode is active.

## Tanks

- Tanks are Catalog-owned content and are stored in `catalog_tank` / `catalog_tank_media`.
- Legacy `be.html` contained only placeholder cards, so no fake legacy tank records are created.
- Admin can create/edit/delete tanks, prices, content, publish state and gallery.

## Orders integration

- Orders adapter and schema are preserved for future reconnection.
- Periodic Orders sync is disabled while `CATALOG_STANDALONE_MODE=true`.
- Manual sync returns `SKIPPED` rather than mutating the standalone catalog.

## Legacy source

Pinned reference: `LightZex/hpz-aquaroom@865168e0933c72bc0e390a9c1fe694f00a24b7ff`.
Runtime script order follows the approved legacy audit and currently resolves to 94 fish records.
