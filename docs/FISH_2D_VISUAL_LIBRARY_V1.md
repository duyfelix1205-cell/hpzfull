# FISH 2D VISUAL LIBRARY V1

## Status
Current implementation standard for the Product Catalog 2D aquarium surfaces.

## Scope
This release changes visuals only. It does not change:
- Catalog product/business data;
- AquaCare tank CRUD, quantity, logs, issues, reminders or customer ownership;
- AquaQuest inventory, economy, rarity, missions or aquarium actions;
- AquaWorld 3D models or behavior;
- database schemas or API contracts.

## Source asset
The source is the user-supplied grayscale 2D fish master. V1 reuses the same side-view body silhouette and applies species-specific real-world color/pattern references.

V1 approved variants:
1. Betta — Royal Blue
2. Koi — Kohaku
3. Clownfish — Ocellaris
4. Discus — Blue Turquoise
5. Angelfish — Silver
6. Oranda Goldfish — Orange White
7. Arowana — Golden
8. Pufferfish — Spotted
9. Blue Tang — Pacific Blue
10. Shark — Reef Gray

The shared body silhouette is an intentional Phase-1 limitation. Species-specific silhouettes and multi-angle animation are future work.

## Runtime precedence

### AquaCare
1. Existing Catalog primary product image, when available.
2. Shared recognized species 2D sprite from the same-origin atlas.
3. Existing procedural vector fallback for unknown species.

This preserves the existing `visual_asset` API and `quantity` source of truth.

### AquaQuest
- Aquarium swimming view: use shared sprite when the fish name maps to one of the ten species; otherwise keep the existing rarity emoji.
- Fish list cards: existing `image_url` remains first priority; shared sprite is only the fallback before emoji.
- Feeding, cleaning, adding/removing fish and all game economy are unchanged.

### AquaWorld 3D
No change in V1.

## Performance
Production ships one same-origin WebP atlas:
- path: `/assets/fish2d/fish-2d-real-v1.webp`
- layout: 5 columns × 2 rows
- cell: 100 × 50 px
- purpose: avoid ten separate sprite network requests.

AquaCare keeps its existing density policy and exact visual instance count. The atlas changes only how recognized fallback fish are drawn.

## Safety invariants
- no DB migration;
- no API change;
- no external runtime image service;
- no production data rewrite/backfill;
- Catalog real media always wins in AquaCare;
- unknown species keep existing fallback behavior;
- no fish instance is dropped;
- `prefers-reduced-motion` behavior remains intact.

## Future
- species-specific silhouettes;
- multi-angle sprite animation;
- per-species fin/tail motion;
- additional approved species/variants;
- optional shared asset registry for other NEXORA applications.
