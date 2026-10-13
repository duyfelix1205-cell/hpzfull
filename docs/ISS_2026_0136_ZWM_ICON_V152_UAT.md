# ISS-2026-0136 — FV05 Icon Integration V1.5.2: Scope & UAT

## Source of truth and evidence

- Desk Issue: `ISS-2026-0136`, `app_id=zwmarket`, UUID `6b4614b8-52fd-4f5c-98f5-9cec9628afbc`.
- Approved attachment: `ZWM_FV05_Direct_Extraction_V1.5.2_FULL.zip`, SHA-256 `3d52edf65f9bf9baa7b595f8e6a4fdd118c6184f3b6ac933edabab846537791a`.
- ZIP holds exactly 24 RGB opaque 256×256 WebP plus 24 RGB opaque 512×512 PNG, original manifest & extraction report.
- Original assets, complete manifest and extraction report are imported byte-for-byte under `frontend/public/zwmarket/category-icons/v1.5.2`; no redraw, conversion, cropping, flattening, recolor or image effects.
- `EXTRACTION_REPORT.txt` explicitly states **READY FOR WEB UAT, NOT VISUAL UAT PASSED**. Navy seams and clipped Glow are known accepted review risks.

## Exact categories and integration policy

- `frontend/src/zwmarket-category-icon-map.js` uses the exact 24 labels from the approved manifest, matching case-insensitively with NFC and whitespace trimming for display, without creating/editing/deleting a business category.
- The existing Catalog Market API `GET /api/v1/catalog/market/categories` derives category labels from existing public posts. Source at `backend/src/routes/market.js`. No hardcoded category seeding was added.
- On preimplementation read-only production audit (2026-10-10), the API returned **0 public categories**. Therefore, **0 live public categories currently render an icon** without new approved/published posts. This is a data visibility condition, not evidence of an image fallback failure.
- The map is complete for 24 Manifest labels and displays only when an actual post category equals a mapped label. Unknown values such as `Khác` stay unchanged as text.
- Do not map vague category names (e.g. `Cá` → `Cá cảnh`) or infer a category hierarchy without Product approval.

## Existing placements (no new business feature)

1. **Explore** category filter chips only where API returns a real category. Existing filter callbacks remain `setCategory(x.category)`.
2. **Listing Cards** the existing category badge (first item in tag row), retaining post tags and Sold status. No icon replaces real post photography.
3. Sidebar navigation is functional (Home/Explore/Sessions/etc.), **not a category navigation list**, so no icons inserted there. No dedicated category cards exist in current source; none are added just for this issue.
4. All other unknown categories retain existing text with no empty icon/placeholder.

## Visual/master safeguards

- WebP via `picture/source`, PNG fallback; original dimensions 256/512 unchanged.
- `object-fit:contain` with square intrinsic size, no stretch or clipping; no alpha assumptions.
- No CSS gradient, glow, blend, filter, overlay, transforms applied to the image.
- Desktop and mobile category filter remain clickable/touch-friendly; text remains available to screen readers while the icon is decorative.

## Business/data safety

- No DB migration, database writes, seed, reset, new business category, search behavior, moderation, post ownership, seller contact permission, order integration, session lifecycle or Stage Hero change.
- Original code remains source of truth for API and category selection, not ZIP Manifest.
- Regression checks verify 24 label matches, all 48 SHA-256 assets, filter handlers, fallback and no image effects.

## UAT and known gaps

- **CODE DONE** only when PR CI and deploy gates PASS and original icon images are served by production.
- **Visual UAT PASSED** is not claimed until Owner inspects icons on pages containing the corresponding actual categories.
- Current production has no published category values; Owner can retest with pre-existing legitimate published posts as they become available. No dummy posts/categories are introduced.
- Any mismatched category, visible Navy seam/Glow cropping should be reported as visual follow-up, without blocking this integration unless material usability is broken.
