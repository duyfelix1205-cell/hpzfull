# M7 — Hardening / RBAC adapter / Audit / Categories / Stale stock

## Admin authorization
`ADMIN_AUTH_MODE=off` is only for local/dev. K3s example uses `trusted_headers`.
In trusted-header mode the upstream trusted ingress/BFF must inject:
- `x-nexora-user-id`
- `x-nexora-roles` (comma separated)

Allowed roles are configured by `ADMIN_ALLOWED_ROLES`. This is an app-side adapter only; it does not define or replace Nexora IAM/SSO contracts.

## Audit
Every non-GET `/api/v1/admin/**` request writes actor, roles, method, path, status, request id and timestamp to `catalog_admin_audit`. Request bodies are deliberately not persisted.

## Categories
Catalog owns presentation categories. Admin can create/update categories and replace product-category assignments. Public API exposes active categories and accepts `?category=<slug>`.

## Legacy mapping review
M6 mapping APIs are surfaced in Admin UI in M7 so mappings can be reviewed and manually confirmed against canonical Orders `product_id` values. No fuzzy match is auto-committed.

## Stale stock
`STOCK_STALE_SECONDS` defaults to 300 seconds. Public product APIs expose `stock_stale` and `stock_age_seconds`. Last successful cached quantity remains visible according to `stock_display_mode`; the UI marks stale data rather than fabricating a new quantity.
