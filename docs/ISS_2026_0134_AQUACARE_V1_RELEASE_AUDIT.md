# ISS-2026-0134 — HPZ AquaCare Implementation V1

## Authority and original code
- Approved: Desk attachment `HPZ_AquaCare_DESK_Implementation_V1.md` (Owner APPROVED).
- Behavior reference only: `aquacare_prototype_corrected(1).html`. Its localStorage, demo fish, simulated Human controls, example data and colors have NOT been imported.
- Source baseline: `tranhung204/nexora-product-catalog` latest `main` at implementation start `6ee3c279c068945c080996225e3204e16724206b`.
- Scope AquaCare only (`/care` + `/api/v1/aquacare` + authenticated `/api/v1/admin/catalog/aquacare`). No direct Orders PostgreSQL, no market/CRM business rewrite.

## Requested Issues audit (KEEP / FIX / ADD)

| Approved item | Treatment | Implementation |
|---|---|---|
| AC-F01, AC-A05 — 4 Incident states | FIX | Pure `assertIncidentAction`, V1 state constraint, audited OPEN→ACTIVE, previously RESOLVED immutable |
| AC-F02, AC-A07 — Resolution authority | FIX | Explicit Customer confirmation and basis; HPZ Admin actor and basis; legacy status PATCH guarded |
| AC-F03, AC-A01 — No-tank Concern and Relationship | ADD | `care_relationship`, nullable incident tank, `POST /incidents`, no fake aquarium |
| AC-F04 — Continuous care progression | ADD | Append-only `care_event` with actor/source/timestamp, Incident timeline and HPZ Human checkpoints |
| AC-F05, AC-A09 — Care History | ADD | Combined events + existing tank logs by stable customer ID, optional verified tank filter |
| AC-A02 — Bounded A/B/C/D | ADD | `evaluateCareDecision` with safe guidance; decision distinct from Incident State |
| AC-A03 — Normal Care | KEEP + ADD | Existing tank logs/reminders retained; `GET /normal-care` generic guidance + actually recorded context |
| AC-A04 — Human continuity | ADD | Customer REQUESTED, admin-only ACKNOWLEDGED/CONTRIBUTED and Human resolution; **no simulated staff acknowledgement** |
| AC-A06 — Evidence / follow-up | ADD | Customer EVIDENCE, OUTCOME, NO_OUTCOME, RESUME; text persisted. **Media uploads not available in V1; explicitly rejected, not fabricated** |
| AC-A08 — Recurrence | ADD | New Incident with `previous_issue_id` referencing a resolved prior Incident; original immutable |
| S02/S03 — Existing tank/Catalog/manual fish/orders | KEEP + FIX safety | Keep TankCanvas, tank CRUD, fish picker, opt-in purchased-item attach. Replace manual fish DELETE+reseed during tank edit with update-in-place and soft removal to retain stable tank_item IDs/history |

## PLAN implementation gates

- **PLAN-AC-01 Core Logic:** 4-state model, relationship without aquarium, legacy audit event and conversion, ownership and explicit resolution validation. Subject to CI/production DB migration.
- **PLAN-AC-02 Care Experience:** deterministic bounded decisions, normal care, Human events/admin authority, evidence text, recurrence and Care History. Genuine Human actor only through the existing secured Admin API. Media unsupported and explicitly reported.
- **PLAN-AC-03 Functional UX:** three top-level functional areas Hôm nay/Bể của tôi/Chăm sóc with Care Home, existing Aquarium Canvas and editing, Care Experience, Incident timeline. Reuses existing HPZ Design System V2; no Visual Master replacement.

## S01–S15: source regression evidence vs Owner UAT

| Scenario | What is testable in code |
|---|---|
| S01 | Relationship start and optional tank on new Concern |
| S02 | Old tank CRUD + in-place update to retain fish IDs |
| S03 | Manual/OTHER_STORE fish accepted and existing catalog picker unchanged |
| S04 | OBSERVATION/EVENT route stores timeline event without creating Incident |
| S05 | Context-limited general Normal Care, only actual readings |
| S06 | Guidance question creates Care event, not Incident |
| S07 | Missing context safely classed B/D; no fabricated measurements |
| S08 | A safe bounded checklist; C urgent Human |
| S09 | Persistent same-Incident event log and actor attribution |
| S10 | Human REQUESTED vs actual authenticated ACKNOWLEDGED/CONTRIBUTED |
| S11 | Text Evidence supported; real media upload explicitly unsupported |
| S12 | Confirmed Customer/Human resolution requires basis |
| S13 | NO_OUTCOME and silence cannot close/resume |
| S14 | RESOLVED immutable; recurrence new linked Incident |
| S15 | Customer-ID isolation and validated tank filters for history |

**Testing interpretation:** unit/static regressions verify domain rules and code wiring; production health/integration smoke verifies route deployment/isolation. Those checks are **not** a substitute for authenticated end-user S01–S15 UAT. Owner/Testers must exercise accounts, Human staff access and representative legacy data before recording `UAT PASSED`.

## Data protection and rollback

- Migration `025` is transactional via current migration runner, audits unknown states before alteration, preserves prior legacy statuses in append-only `LEGACY_IMPORTED` event and maps only `OPEN→ACTIVE`. Already `RESOLVED` incidents remain resolved.
- No data reset/reseed. Existing `aquacare.tank`, `tank_item`, `care_log`, `reminder`, Customer Account, catalog and Orders data remain.
- Existing manually entered fish are updated in place or soft-removed instead of deleted/reinserted, preserving `tank_item_id` and old Incident references.
- New event ledger is append-only. Reverting frontend/backend is possible, but **DB migration is forward-only**: retain new state/ledger and deploy backward-compatible code or plan a reviewed rollback. Do not drop history tables.
- No change in ZWMarket.
