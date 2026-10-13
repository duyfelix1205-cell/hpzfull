#!/bin/sh
set -eu
: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${CATALOG_DOMAIN:?CATALOG_DOMAIN is required}"
SRC="${1:-deploy/k3s/prod}"
OUT="${2:-/tmp/product-catalog-rendered}"
rm -rf "$OUT"
mkdir -p "$OUT"
for file in "$SRC"/*.yaml "$SRC"/*.yaml.tpl; do
  [ -f "$file" ] || continue
  name="$(basename "$file" .tpl)"
  sed \
    -e "s/__IMAGE_TAG__/${IMAGE_TAG}/g" \
    -e "s/__CATALOG_DOMAIN__/${CATALOG_DOMAIN}/g" \
    "$file" > "$OUT/$name"
done
if grep -R '__[A-Z0-9_][A-Z0-9_]*__' "$OUT" >/dev/null 2>&1; then
  echo '[render] unresolved placeholders:' >&2
  grep -R '__[A-Z0-9_][A-Z0-9_]*__' "$OUT" >&2
  exit 1
fi
printf '%s\n' "$OUT"
