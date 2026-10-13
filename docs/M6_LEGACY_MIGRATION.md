# M6 — HPZ Aquaroom legacy migration

Source reference: `LightZex/hpz-aquaroom` at legacy baseline SHA `865168e0933c72bc0e390a9c1fe694f00a24b7ff`.

## Safety rules
- Legacy is import/reference input only; it is not Product Master.
- Legacy `vn`, `en`, `price`, `combo`, stock-like fields never overwrite Orders-owned source fields.
- No fuzzy match is automatically committed.
- Exact normalized name matches become `REVIEW_REQUIRED`, never `MATCHED`.
- A human must confirm each `legacy_key -> PRD-*` mapping.
- Import fills only empty Catalog-owned content fields and imports media idempotently.

## Effective dataset
The extractor executes the same runtime mutation order used by legacy pages:
`fish-data.js`, `fish-fix.js`, `chuotmy-fix.js`, `paraiba-fix.js`, `red-devil-fix.js`, `cobalt-fix.js`, `royal-fix.js`, `mana-altum-fix.js`, `ica-bar-fix.js`, `red-allen-fix.js`.

Validated against the supplied/current legacy snapshot: 94 effective records; all 94 contain description, price and at least one gallery item.

## Commands
```bash
cd backend
node scripts/extract-effective-legacy.mjs /path/to/hpz-aquaroom /tmp/effective-legacy.json
npm run migrate
npm run legacy -- stage /tmp/effective-legacy.json
npm run legacy -- status REVIEW_REQUIRED
npm run legacy -- confirm hpz-fish-... PRD-...
npm run legacy -- import /path/to/hpz-aquaroom          # dry-run default
npm run legacy -- import /path/to/hpz-aquaroom --apply  # explicit write
```

The `--apply` import copies approved legacy image files into Catalog media storage/PVC and stores only metadata/storage keys in PostgreSQL. Existing Catalog content is preserved; legacy values fill blank Catalog-owned fields only.
