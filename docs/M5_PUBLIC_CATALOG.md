# M5 — Public HPZ Aquaroom dynamic catalog

## Goal
Replace the legacy `fish-data.js` + runtime `*fix.js` read path with the NEXORA Product Catalog REST API while preserving the recognizable HPZ Aquaroom public layout and navigation.

## Routes
- `/` — public home with dynamic featured products.
- `/beca.html`, `/catalog`, `/products` — dynamic product list/search.
- `/fish/<slug>` and `/product/<slug>` — canonical product detail.
- `/fish.html?fish=<legacy name>` — compatibility resolver for old links during migration.
- `/admin` — unchanged Catalog Admin.

## Data source
Public pages only read `/api/v1/catalog/products` and `/api/v1/catalog/products/{slug}`. They do not load `fish-data.js`, legacy fix scripts, or any CRM database.

## Visual parity
M5 preserves the legacy information architecture, dark underwater treatment, header/navigation, orange CTA, card grid, search and detail/gallery pattern. Binary legacy scene assets remain migration input for M6; M5 does not make the new app depend on the old repository at runtime.

## Exit checks
- published products render from API;
- search uses API query;
- detail renders content + Catalog media + Orders-owned price/stock snapshot;
- legacy `fish.html?fish=` links can resolve during migration;
- Admin route remains isolated;
- production build passes CI.
