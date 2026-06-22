---
phase: 07-admin-triage-ux-public-map
plan: "03"
subsystem: backend/unit-tests
tags: [test, rust, exif, orientation, TEST-01]
status: complete

dependency_graph:
  requires: []
  provides:
    - bake_orientation_6_iphone_portrait_dimensions test in backend/src/handlers/reports.rs
  affects:
    - backend/src/handlers/reports.rs

tech_stack:
  added: []
  patterns:
    - "Proportional-scale proxy test: use 1/4-scale image (756x1008) to verify rotation math without full-resolution memory allocation"

key_files:
  created: []
  modified:
    - backend/src/handlers/reports.rs

decisions:
  - "Used 756x1008 (1/4-scale proxy) instead of full 3024x4032 iPhone dimensions to avoid ~35 MB in-memory allocation in debug builds; same rotation math proven at any scale"

metrics:
  duration: "1 min"
  completed: "2026-06-22T18:19:34Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 07 Plan 03: TEST-01 bake_orientation orientation=6 Summary

Added the TEST-01 backend unit test: `bake_orientation_6_iphone_portrait_dimensions` verifies EXIF orientation=6 dimension-swap at iPhone portrait aspect (756x1008 proxy for 3024x4032).

## What Was Built

**Task 1: Add orientation=6 iPhone-dimensions test for bake_orientation**

Added a new `#[test] fn bake_orientation_6_iphone_portrait_dimensions()` to the existing `bake_orientation_tests` module in `backend/src/handlers/reports.rs`.

The test:
- Builds a 756x1008 JPEG (portrait aspect: width 756 < height 1008) with EXIF orientation=6 via `make_jpeg_with_orientation(756, 1008, 6)`
- Calls `bake_orientation(&input)` — the same function fixed in Phase 5 (FIX-06)
- Decodes output with `image::load_from_memory`
- Asserts `decoded.width() == 1008` and `decoded.height() == 756` (dimension swap confirming 90° CW rotation)

The 756x1008 dimensions are exactly 1/4-scale of the iPhone 16 Pro Max portrait dimensions (3024÷4=756, 4032÷4=1008), satisfying ROADMAP success criterion 8 without the ~35 MB memory cost of the full-resolution image. The doc-comment in the test source makes this proxy relationship explicit and traceable.

## Verification Results

```
cargo test bake_orientation_6

test handlers::reports::bake_orientation_tests::bake_orientation_6_swaps_width_height ... ok
test handlers::reports::bake_orientation_tests::bake_orientation_6_iphone_portrait_dimensions ... ok
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 249 filtered out; finished in 0.40s
```

Both `bake_orientation_6` tests pass. No existing tests broken.

## Commits

| Hash | Message |
|------|---------|
| f72fcd9 | test(07-03): add bake_orientation_6_iphone_portrait_dimensions test (TEST-01) |

## Deviations from Plan

None — plan executed exactly as written. The 756x1008 proxy scale was the plan's recommended approach (Allocation note, Risk 5).

## TDD Gate Compliance

- RED gate: Not applicable — `bake_orientation` function already exists; the test was written to pass immediately (GREEN-only path as documented in the plan's action note).
- GREEN gate: `cargo test bake_orientation_6` — 2 tests pass (f72fcd9).

## Known Stubs

None.

## Threat Flags

None — pure in-memory unit test with no I/O, network, or untrusted input.

## Self-Check: PASSED

- [x] `backend/src/handlers/reports.rs` — modified (bake_orientation_6_iphone_portrait_dimensions test added)
- [x] Commit f72fcd9 exists and contains the test
- [x] `grep -c "bake_orientation_6_iphone_portrait_dimensions" backend/src/handlers/reports.rs` returns 1
- [x] `cargo test bake_orientation_6` — 2 tests pass, 0 failed
