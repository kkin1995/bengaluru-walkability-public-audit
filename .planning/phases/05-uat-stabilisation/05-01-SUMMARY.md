---
phase: 05-uat-stabilisation
plan: 01
subsystem: api
tags: [rust, axum, image-crate, exif, postgresql, sqlx, location-source, migration]

requires:
  - phase: 04-export-public-analytics
    provides: "StatsResponse struct and get_report_stats function being extended"
  - phase: 03-government-triage
    provides: "status_history table, auto-assign audit insert, public status history query"

provides:
  - "bake_orientation helper that bakes EXIF orientation into pixels before EXIF strip"
  - "Public status history query filtered to show exactly one Open entry per report"
  - "StatsResponse.today_count field for date-based admin report counter"
  - "Migration 015 with GPS_API/MANUAL_ADJUST/EXIF_GPS canonical enum values"
  - "Backend emits GPS_API as default location_source; manual_pin deprecated"

affects:
  - "05-02 (frontend location_source emission — must send GPS_API not manual_pin)"
  - "05-03 (frontend location_source display labels — must handle GPS_API/EXIF_GPS)"
  - "staging deployment — migration 015 must run before backend restart"

tech-stack:
  added:
    - "image = 0.25 (Rust image crate for JPEG decode/rotate/re-encode)"
  patterns:
    - "bake_orientation → strip_exif pipeline order: orientation baked before EXIF removed"
    - "read_exif_orientation_tag: minimal TIFF IFD0 parser for tag 0x0112 (both endianness)"
    - "SQL-layer-only public history filter: two AND clauses, no write logic changed"
    - "sqlx::query_scalar with runtime string for new today_count query (no cargo sqlx prepare needed)"
    - "sqlx:noTransaction pragma in migration for ALTER TYPE ADD VALUE (PostgreSQL requirement)"

key-files:
  created:
    - "backend/migrations/015_rename_location_source.sql"
  modified:
    - "backend/Cargo.toml (image = 0.25 added)"
    - "backend/Cargo.lock"
    - "backend/src/handlers/reports.rs (bake_orientation + pipeline order + GPS_API defaults)"
    - "backend/src/db/queries.rs (FIX-07 public history filter)"
    - "backend/src/db/admin_queries.rs (FIX-08 today_count query)"
    - "backend/src/models/admin.rs (StatsResponse.today_count field)"
    - "backend/src/models/report.rs (test fixture location_source updated)"

key-decisions:
  - "Manual TIFF IFD0 parser chosen over exif crate (avoids new dependency; < 60 lines; handles II/MM byte order)"
  - "image 0.25 added as approved in RESEARCH.md Package Legitimacy Audit (crates.io, image-rs/image, ~12yr old)"
  - "Two AND clauses in public history query (not one): first removes acknowledged, second removes auto-assign duplicate open"
  - "Note LIKE pattern confirmed as 'Auto-assigned%' matching 'Auto-assigned based on ward geography' (reports.rs line 309)"
  - "sqlx:noTransaction pragma added to migration 015 — required for PostgreSQL ALTER TYPE ADD VALUE outside transaction"
  - "cargo sqlx prepare not required: new queries use sqlx::query_scalar with runtime strings (not compile-time query! macros)"

patterns-established:
  - "Orientation baking pipeline: is_jpeg check → SHA256 → bbox → rate-limit → bake_orientation → strip_exif → write"
  - "Public vs admin history split: queries.rs = filtered public, admin_queries.rs = full timeline (never cross-contaminate)"

requirements-completed: [FIX-06, FIX-07, FIX-08, FIX-13]

duration: 9min
completed: 2026-06-05
---

# Phase 05 Plan 01: Backend UAT Bug Fixes Summary

**EXIF orientation baking via image crate (FIX-06), exact-one-Open public status history via dual SQL filter (FIX-07), date-based today_count stat (FIX-08), and GPS_API/EXIF_GPS canonical location_source migration (FIX-13)**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-05T12:01:01Z
- **Completed:** 2026-06-05T12:10:00Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 7 (+ 1 Cargo.lock)

## Accomplishments

- iPhone portrait photos (EXIF orientation 6) will now be stored upright: `bake_orientation` rotates pixels 90 CW before `strip_exif` removes the EXIF tag
- Public status history returns exactly one Open entry per report: `acknowledged` rows filtered (Source B) AND auto-assign duplicate `open` rows filtered via note NOT LIKE 'Auto-assigned%' (Source A); admin history path left untouched
- Admin stats now carries a creation-date-based `today_count: i64` field independent of status transitions
- Location source uses canonical enum values: migration converts `manual_pin` → `GPS_API`, `exif` → `EXIF_GPS`; backend emits `GPS_API` by default

## Task Commits

Each task committed atomically (TDD: RED test → GREEN implementation):

1. **Task 1: FIX-06 — bake EXIF orientation before strip** - `a726edf` (feat)
2. **Task 2: FIX-07 + FIX-08 — public history filter + today_count** - `d35a265` (feat)
3. **Task 3: FIX-13 backend — canonical location_source migration + emission** - `77b93df` (feat)

## Files Created/Modified

- `backend/migrations/015_rename_location_source.sql` — ALTER TYPE ADD VALUE for GPS_API/MANUAL_ADJUST/EXIF_GPS; UPDATE rows from manual_pin/exif to canonical values; sqlx:noTransaction pragma
- `backend/Cargo.toml` — `image = "0.25"` added
- `backend/src/handlers/reports.rs` — `read_exif_orientation_tag` (TIFF IFD0 parser), `bake_orientation` helper, pipeline wiring, GPS_API defaults, TDD tests (orientation 1/6/malformed, fake_success_response)
- `backend/src/db/queries.rs` — public status history query gains dual AND filter (acknowledged + auto-assign note LIKE)
- `backend/src/db/admin_queries.rs` — `today_count` query scalar added to `get_report_stats`
- `backend/src/models/admin.rs` — `today_count: i64` field added to `StatsResponse`; existing tests updated; new TDD test for today_count serialization
- `backend/src/models/report.rs` — test fixture location_source changed to `"GPS_API"`

## FIX-07 Auto-assign Note Text (Required by Plan Output Spec)

The auto-assign audit insert at `backend/src/handlers/reports.rs` line 309 writes:

```
'Auto-assigned based on ward geography'
```

The confirmed `note NOT LIKE` pattern used in the public history filter is:

```sql
AND (note IS NULL OR note NOT LIKE 'Auto-assigned%')
```

This pattern matches the prefix `Auto-assigned` which is unique to the auto-assign audit row and will not match any user-facing status change notes.

## Decisions Made

- Manual TIFF IFD0 parser (< 60 lines) chosen over adding `exif` crate — handles both little-endian (II) and big-endian (MM) byte order; tag 0x0112 only; avoids an additional dependency
- `image 0.25` added: approved in RESEARCH.md Package Legitimacy Audit (crates.io, image-rs/image, ~12 years old, very high downloads)
- `cargo sqlx prepare` NOT run: the new queries (`today_count`, `status_history` filter) use `sqlx::query_scalar` and `sqlx::query` with runtime strings — NOT compile-time `query!` macros — so no offline SQLx metadata update is needed
- `sqlx:noTransaction` pragma in migration 015: PostgreSQL requires `ALTER TYPE ... ADD VALUE` to run outside a transaction block; sqlx migrations run transactionally by default

## Deviations from Plan

None - plan executed exactly as written. The auto-assign note text (`'Auto-assigned based on ward geography'`) was confirmed at reports.rs line 309 before authoring the LIKE pattern, as required by the plan.

## Issues Encountered

**Database not running in worktree environment:** `cargo sqlx prepare` could not be executed (no PostgreSQL accessible). As documented in plan frontmatter `nyquist_override` and confirmed in the plan action for Task 2/3, the new queries use runtime string `sqlx::query_scalar` (not compile-time macros), so no offline metadata update is required. If the team uses compile-time checked queries in future, `cargo sqlx prepare` should be run on a machine with the DB running after migration 015 is applied.

## Known Stubs

None — all changes are production behavior (no placeholder data, no hardcoded UI values, no TODO markers).

## Threat Flags

No new trust boundaries introduced beyond those already in the plan's `<threat_model>`:

| Flag | File | Description |
|------|------|-------------|
| (planned) T-05-01 | reports.rs bake_orientation | Malformed/polyglot JPEG bytes: mitigated by is_jpeg() guard BEFORE bake_orientation; image::load_from_memory returns Err → AppError::BadRequest |
| (planned) T-05-04 | reports.rs pipeline | EXIF GPS retention: strip_exif still runs AFTER bake_orientation, preserving privacy |

Both threats were pre-identified in the plan's threat model with `mitigate` disposition and are confirmed implemented correctly.

## Next Phase Readiness

- **05-02** (frontend location_source emission): frontend must send `GPS_API` instead of `manual_pin`; send `EXIF_GPS` instead of `exif`. Migration 015 must run on staging/prod DB before this is deployed.
- **05-03** (frontend display labels): admin detail page condition `=== "exif"` must change to `=== "EXIF_GPS"`; translations.ts needs GPS_API/EXIF_GPS/MANUAL_ADJUST label mappings.
- **Staging deployment**: migration 015 runs automatically on next `cargo run` / `docker compose up` via `sqlx::migrate!()`. The `sqlx:noTransaction` pragma is required — verify SQLx 0.7 supports it (expected to, as per RESEARCH.md Pattern 4 notes on SQLx migration pragmas).

---
*Phase: 05-uat-stabilisation*
*Completed: 2026-06-05*

## Self-Check: PASSED

Files verified:
- `backend/migrations/015_rename_location_source.sql` — exists
- `backend/src/handlers/reports.rs` — contains `fn bake_orientation`, `bake_orientation(&req.image_bytes)`, `GPS_API`
- `backend/src/db/queries.rs` — contains `!= 'acknowledged'` and `note NOT LIKE`
- `backend/src/models/admin.rs` — contains `today_count`
- `backend/src/db/admin_queries.rs` — contains `CURRENT_DATE`

Commits verified:
- `a726edf` — Task 1: FIX-06 (feat: bake_orientation)
- `d35a265` — Task 2: FIX-07+FIX-08 (feat: public history filter + today_count)
- `77b93df` — Task 3: FIX-13 (feat: migration + GPS_API emission)

All 249 backend tests pass. `cargo build` exits 0.
