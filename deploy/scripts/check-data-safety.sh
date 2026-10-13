#!/usr/bin/env sh
set -eu

rendered_dir="${1:-/tmp/catalog-rendered}"
migrate_manifest="$rendered_dir/30-migrate-job.yaml"

fail() {
  echo "[DATA-SAFETY][ERROR] $*" >&2
  exit 1
}

[ -s "$migrate_manifest" ] || fail "missing rendered migration manifest"

grep -q 'npm run migrate' "$migrate_manifest" || fail "production migration command missing"
if grep -q 'seed:legacy' "$migrate_manifest"; then
  fail "production deploy must never run legacy/demo seed"
fi
grep -q 'name: pre-migration-backup' "$migrate_manifest" || fail "pre-migration backup initContainer missing"
grep -q 'claimName: catalog-backups' "$migrate_manifest" || fail "migration job must mount backup PVC"
grep -q 'pg_dump' "$migrate_manifest" || fail "pre-migration backup must use pg_dump"
grep -q 'sha256sum' "$migrate_manifest" || fail "pre-migration backup checksum missing"

for file in backend/db/migrations/*.sql; do
  [ -f "$file" ] || continue
  if grep -Eiq '(^|[^A-Za-z])(TRUNCATE|DROP[[:space:]]+(TABLE|SCHEMA|DATABASE)|DELETE[[:space:]]+FROM|ALTER[[:space:]]+TABLE[^;]*DROP[[:space:]]+COLUMN)([^A-Za-z]|$)' "$file"; then
    grep -q 'DATA-SAFETY: ALLOW-DESTRUCTIVE' "$file" || fail "destructive SQL found in $file without explicit DATA-SAFETY approval marker"
  fi
done

env -u SEED_LEGACY_STANDALONE NEXORA_ENVIRONMENT=production node --input-type=module -e "import('./backend/src/config.js').then(({config})=>{if(config.seedLegacyStandalone){console.error('legacy seed enabled by default in production');process.exit(1)}})"

grep -q "RELEASE_SMOKE_READ_ONLY" backend/src/routes/admin-sync.js || fail "release smoke must not execute source sync mutations"

echo '[DATA-SAFETY] production data safety gates passed'
