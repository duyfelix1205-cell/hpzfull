# ZWMarket asset release audit — ISS-2026-0130 / ISS-2026-0131

Date: 2026-10-09. This report does **not** authorize icon release.

## ISS-2026-0130 — Hero Stage artwork

- Current source: `frontend/public/zwmarket/stage.png`.
- Locked Git blob SHA-1: `80237fa405c52f101fc578c24c91071caac82a8b`.
- Desk issue does not contain a ZWM-A01 master file, approved checksum or confirmation that `stage.png` is ZWM-A01.
- Existing dynamic session stage, dates, countdown and CTA are retained; the static heading is aligned with the Desk wording “Chợ cá cuối tuần.”.
- Corrected a concrete asset-boundary violation: the same Stage image was reused as sidebar art. The sidebar now uses a non-image CSS atmosphere; the **Hero bitmap remains unchanged**.
- **Blocker:** HPZ must confirm the current image is the exact approved ZWM-A01, or provide its authentic file. Do not generate or replace artwork speculatively.

## ISS-2026-0131 — 24 Micro-Illustration icons

Desk attachment: `ZWM_2D_Icon_System_V1.zip`, SHA-256 `485935f10102b51de49ce717bcce57bcd69399f79337a98446548b248502df8d` (3,734,997 bytes). This ZIP was read from Desk directly, **not** from an older chat handoff.

The archive contains 24 PNG (512×512), 24 WebP (manifest states 256×256), a manifest and visual previews. An independent PNG decoder checked all **24 original PNGs**: RGBA8, 512×512, transparent corners and non-trivial transparency. The structural alpha check found no failures.

However, `EXPORT_REPORT.txt` explicitly says **ASSET EXPORT INCOMPLETE**. The manifest marks every image `EXTRACTED_APPROXIMATE_UNVERIFIED` and explains it was extracted from a flattened preview rather than exported from original editable layers. Visual inspection of the supplied preview and individual fish/shrimp samples reveals potentially degraded boundaries/glow. An alpha-pass **does not** prove release readiness or fidelity to the approved visual design.

At inspection time, the live `/api/v1/catalog/market/categories` endpoint returned `{"items":[]}`, so there were no public live category labels against which to prove an exact production icon mapping.

**Safety decision:** do not publish these unverified icons to production or invent category names/mappings. Current text-only category filters and fallback remain fully functional. Nothing in the ZIP is used to reseed or modify customer posts.

### Required for completion

1. HPZ provides production-quality exports from original artwork/layers, **or** explicitly approves the exact extracted ZIP's visual defects after preview review.
2. Verify PNG/WebP transparency, edges and glow on both `#06141C` and `#102630` at 32/48/64 px for each icon enabled.
3. Map only **exactly matching existing category names** to approved icon files; leave any unmatched category text/placeholder intact; do not create categories.
4. Implement frontend-only icon rendering in existing category chips/cards, preserve category API, click/filter/search, and test desktop/mobile.
5. Release with CI, production SHA, health/smoke, Source Vault and Desk readback verified.

This audit is a technical handoff, **not** approval to deploy unverified imagery.
