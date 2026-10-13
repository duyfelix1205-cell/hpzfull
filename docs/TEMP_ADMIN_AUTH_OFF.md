# TEMP — Catalog Admin Auth Off

Temporary test state requested on 2026-09-17.

- Standalone Catalog Admin authentication is intentionally bypassed for testing.
- `/admin` opens directly.
- `/api/v1/admin/*` is reachable while standalone mode is enabled.
- Existing password/trusted-header implementation remains in source for later re-enable.
- Planned password when auth is re-enabled: managed separately; do not store plaintext in Git.

Do not treat this as the final security state.
