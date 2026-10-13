# M8 — Production Readiness

## Production definition
Product Catalog is not production merely because M8 code is merged. Production requires the approved DoD: CI PASS, deployment success, DB/backend/frontend health, Public smoke, internal Admin smoke, real Orders sync, backup verification, Sentry configured without obvious regression, and public visual acceptance.

## GitHub configuration required
Repository Variables:
- `CATALOG_DOMAIN` — real public hostname, no scheme.
- `CATALOG_ORDERS_BASE_URL` — CRM Orders producer base URL.

Repository Secrets:
- `CATALOG_POSTGRES_PASSWORD`
- `CATALOG_DB_URL`
- `CATALOG_ORDERS_INTERNAL_TOKEN`
- `CATALOG_SENTRY_DSN`

The deploy job intentionally fails preflight when any required value is absent.

## Runner dependency
Deployment uses the existing K3s self-hosted runner labels `self-hosted`, `linux`, `hpz-crm`, matching the currently proven Orders deployment path. The runner must have Docker plus kubectl/k3s access to the target cluster. This is a shared platform dependency; it does not make Product Catalog part of the Orders namespace.

## Namespace and storage
Namespace is always `product-catalog`. It owns:
- PostgreSQL PVC `catalog-postgres`
- media PVC `catalog-media`
- backup PVC `catalog-backups`

Backend runs non-root with `fsGroup=1000`, allowing `/app/uploads` to be writable by the Node container.

## Admin exposure
Public ingress does not expose Admin API before trusted IAM/BFF integration exists. Production Nginx returns 404 for `/api/v1/admin/*`. Admin smoke runs directly against `catalog-backend` inside the namespace with trusted headers. Future Portal/IAM exposure must sanitize incoming identity headers before injecting `x-nexora-user-id` and `x-nexora-roles`.

## TLS
Ingress uses Traefik and the existing cluster-scoped `letsencrypt-prod` ClusterIssuer. Deploy preflight fails if that issuer is absent; the application workflow does not create cluster-global certificate authority resources.

## Sentry
Backend and frontend share one Product Catalog Sentry project and distinguish events with tags required by the Nexora standard:
- `app_id=product-catalog`
- `service=backend|frontend`
- `environment=production`
- `namespace=product-catalog`
- `release=product-catalog@<git_sha>`
- `deploy_sha=<git_sha>`

Default PII sending is disabled and traces are disabled initially. Runtime request bodies, tokens, cookies, passwords and secrets are not added to Sentry tags.

## Backup
`catalog-backup` runs daily at 02:15 Asia/Bangkok:
- PostgreSQL custom-format dump every day, retained 14 days.
- Media tarball on Sunday, retained 35 days.
- SHA-256 checksum beside every backup.

Deploy smoke creates a one-off Job from the CronJob and requires a successful DB backup.

### Restore DB
Example operator flow (adjust backup filename):
```sh
kubectl -n product-catalog scale deployment/catalog-backend --replicas=0
kubectl -n product-catalog exec deployment/catalog-postgres -- sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
kubectl -n product-catalog cp /path/to/catalog_TIMESTAMP.dump catalog-postgres-POD:/tmp/restore.dump
kubectl -n product-catalog exec deployment/catalog-postgres -- sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl /tmp/restore.dump'
kubectl -n product-catalog scale deployment/catalog-backend --replicas=1
```
Always run health + smoke after restore.

## Rollback
Application images are immutable per git SHA. Roll back by redeploying a previously green SHA. DB migrations are forward-only; do not assume code rollback also reverses schema. If a migration is destructive, restore DB/media from backup under an approved recovery procedure.

## Known release blockers
- Real `INT-ORD-CAT-001` producer endpoint/token must pass the deploy sync smoke.
- Trusted IAM/BFF path for external Admin access is still an ecosystem integration dependency.
- Public visual parity still requires user acceptance after the first reachable deployment.
