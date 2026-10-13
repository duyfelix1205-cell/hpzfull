# ISS-2026-0143 — ZWM-A01 LOCKed artwork provenance and production verification

## Current / verified (2026-10-11)

Desk Issue: `ISS-2026-0143`, `app_id=zwmarket`, UUID `cee4dcd7-aa9c-40c0-992f-fdcc9a889d37`.

**The exact approved Session Stage artwork was not missing.** It is already stored at
`frontend/public/zwmarket/stage.png`. Do not rename, redraw, recolor, recompress, or
replace it with a generated image. ZWM-A01 is the Owner's historical asset designation;
the application intentionally stores the same bytes as `stage.png`.

Independent evidence:

1. The Owner's retained `ZWM_VISUAL_MASTER_SOURCE_V2.html` has an embedded
   `data:image/png;base64` on the Session Stage. The embedded payload was decoded
   and SHA-256 hashed independently of the catalog source.
2. The embedded master image is a valid PNG, **2048 × 768** and **2,769,427 bytes**.
3. Its SHA-256 is
   `826f972c903ae44dfac4d91ac493d921ad0e853e30adf6319b373a2dfe50005d`.
4. The current Git `main` `frontend/public/zwmarket/stage.png` has the **exact same**
   byte count, dimensions, and SHA-256. Matching a cryptographic hash establishes
   byte-for-byte identity with the verified embedded master; this is not a visual guess.
5. The original asset import source was found in Git history: commit
   `7258153746d3a04d84c3378e44770c40d91fed30` ("import locked ZWMarket visual assets")
   removes its one-time import workflow, whose historical patch shows it fetched
   `https://zwmarket-owner-prototype.foxaa.chatgpt.site/assets/stage.png`
   and hard-verified the **same SHA-256** prior to committing.
6. Current Git blob of the Stage PNG is `80237fa405c52f101fc578c24c91071caac82a8b`,
   consistent with the recorded import and previous `ISS-2026-0130` audit.
7. Pre-fix live CDN/HTTPS retrieval from
   `https://catalog.hungtp.click/zwmarket/stage.png` returned the exact same
   SHA-256, 2048 × 768 image, and 2,769,427 bytes (2026-10-11).
   `https://catalog.hungtp.click/market` also returned HTTP 200.

## Scope/boundary

- Session Stage: `frontend/src/zwmarket.css` uses the verified PNG once,
  as `.zwm-stage` background. No bitmap change or layout redesign is necessary.
- Session live state, label, dates, countdown, dynamic timeline, CTA and public
  counts remain in `frontend/src/ZwMarketPage.jsx`; untouched.
- Sidebar: its decorative `.zwm-side-art` uses CSS atmosphere rather than
  `stage.png`; the exact image is **not** reused on Sidebar.
- No changes to ZWMarket API, authorization, database, session lifecycle, listings,
  posts, categories, Orders integrations, other apps, or historical data.

## Root cause and resolution

Prior `ISS-2026-0130` audit verified the Git blob but lacked the independently
retained original A01 checksum/provenance; its conservative blocker was therefore
appropriate. `ISS-2026-0143` requests recovery *or* verification. The retained
Owner Visual Master V2 and the historical import workflow supply the missing
cryptographic identity and provenance. The image itself and its correct placement
were already in production, so only the regression assertion and provenance
documentation require changes.

The existing test `backend/test/zwmarket-stage-artwork-boundary.test.js` now protects:
original Git blob, exact Owner-master SHA-256, PNG size/dimensions, Session-Stage-only
image reference, Sidebar exclusion and current dynamic session controls.

## Release / acceptance distinction

`CODE DONE` requires target PR CI, main CI, exact-SHA production deploy,
health/smoke, Source Vault match and Desk readback. `UAT PASSED` is **not**
claimed by CI or this source audit: Owner visually inspects the live `/market`
Session Stage before tester confirmation. Keep `ISS-2026-0130` in its existing
confirmation lifecycle; do not silently close that separate Issue.
