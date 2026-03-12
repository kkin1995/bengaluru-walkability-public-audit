---
phase: 01-ward-foundation
verified: 2026-03-12T10:30:00Z
status: passed
score: 13/13 must-haves verified
re_verification: true
previous_status: gaps_found
previous_score: 11/13
gaps_closed:
  - "list_admin_reports SQL selects wards.ward_name (not wards.name) — PostgreSQL will execute without error at runtime"
  - "Admin with org_id sees only reports in their org's wards via recursive CTE; admin without org_id sees all reports"
gaps_remaining: []
regressions: []
human_verification:
  - test: "Submit report at known Bengaluru coordinate and confirm ward column shows real ward name"
    expected: "After deploying with the wards.ward_name column fix, submitting a report at a coordinate inside a known ward polygon should auto-populate ward_id; the admin triage queue should then display the ward name in the Ward column, not a dash."
    why_human: "Requires live PostGIS with wards table populated to execute ST_Within spatial query and JOIN. Cannot verify without a running database."
  - test: "Org assignment dropdown on users page shows org names once organizations are seeded, and scoped admin sees filtered reports"
    expected: "After seeding organizations and assigning wards.org_id, an admin with org_id sees only reports from their org's ward subtree. An admin with org_id=NULL sees all reports."
    why_human: "organizations table is intentionally empty at migration time (GBA structure unconfirmed) and wards.org_id is NULL for all 369 wards — org-scoped admins will see zero reports until data is seeded. Cannot verify non-zero scoped result without out-of-band seeding."
---

# Phase 1: Ward Foundation Verification Report

**Phase Goal:** Every report is automatically routed to the correct Bengaluru ward, and the flexible GBA organization hierarchy is in place so admins can be assigned to organizations
**Verified:** 2026-03-12T10:30:00Z
**Status:** passed
**Re-verification:** Yes — after Plans 05 and 06 gap closure (third verification pass)

## Re-verification Summary

Plans 05 and 06 closed the two remaining gaps from the previous verification.

| Gap | Previous Status | Now |
|-----|----------------|-----|
| `wards.name AS ward_name` in list_admin_reports SQL (wrong column) | FAILED | CLOSED — `wards.ward_name AS ward_name` in both production SQL (line 360) and unit test SQL (line 917); 204 backend tests pass |
| Org-scoped report visibility not implemented (WARD-03 / ROADMAP SC#3) | FAILED | CLOSED — recursive CTE in list_admin_reports and count_admin_reports; handler fetches org_id from DB via claims.sub; migration 006_ward_org_scoping.sql adds wards.org_id FK |

**Score:** 13/13 truths verified (up from 11/13)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | wards table exists with GEOMETRY(MULTIPOLYGON,4326) and GIST index | VERIFIED | 004_ward_boundaries.sql lines 7-17; 204 backend tests pass |
| 2 | 369 GBA 2025 ward polygons stored in wards table | VERIFIED | INSERT count = 369; migration_004_has_369_ward_inserts test passes |
| 3 | organizations table exists with self-referential parent_id | VERIFIED | 005_organizations.sql; org_type CHECK constraint; list/assign endpoints |
| 4 | reports table has nullable ward_id UUID FK column | VERIFIED | 004_ward_boundaries.sql ALTER TABLE; Report struct has pub ward_id: Option<Uuid> |
| 5 | admin_users table has nullable org_id UUID FK column | VERIFIED | 005_organizations.sql ALTER TABLE admin_users ADD COLUMN org_id |
| 6 | Report submitted at valid Bengaluru coordinate gets ward_id auto-populated | VERIFIED | get_ward_for_point() in db/queries.rs with ST_Within; wired in handlers/reports.rs before insert |
| 7 | Report at coordinate with no matching ward polygon still commits (ward_id = NULL) | VERIFIED | unwrap_or_else(tracing::warn + None) pattern in handlers/reports.rs |
| 8 | GET /api/admin/organizations returns org tree | VERIFIED | Route in main.rs; admin_list_organizations handler; list_organizations() query |
| 9 | PATCH /api/admin/users/:id/org assigns org to admin user | VERIFIED | Route in main.rs; admin_assign_user_org handler; assign_user_org() query; assign_user_org_sql test |
| 10 | GET /api/admin/reports returns { data, pagination: { page, limit, total_count, total_pages } } | VERIFIED | admin_list_reports handler lines 419-444 return correct shape; tokio::try_join! |
| 11 | Admin reports map page loads without TypeError crash on .filter() | VERIFIED | map/page.tsx: setReports(result.data ?? []); 37 frontend tests pass |
| 12 | Admin reports list page shows submitted reports (no "No reports found" when DB has reports) | VERIFIED | page.tsx: setReports(res.data ?? []); null guard in place |
| 13 | list_admin_reports SQL selects wards.ward_name (correct column) so ward_name is non-null at runtime | VERIFIED | admin_queries.rs line 360: `wards.ward_name AS ward_name`; line 917: same in test SQL; no occurrence of `wards.name AS ward_name` anywhere in file |
| 14 | Reports with ward_name = null display dash — no crash | VERIFIED | ReportsTable.tsx: {report.ward_name ?? "—"} |
| 15 | Admin with org_id sees only reports in their org's wards; admin without org_id sees all | VERIFIED | Recursive CTE `org_subtree` appended to WHERE in both list_admin_reports (line 318) and count_admin_reports (line 252) when org_id is Some; handler (lines 412-439) fetches org_id via claims.sub DB lookup and passes to both queries; 4 new unit tests in admin_queries.rs confirm CTE presence/absence |

**Score:** 13/13 truths verified (2 need human for live-stack confirmation)

---

## Required Artifacts

### Plan 01-01 Artifacts (regression check)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `data/gba_wards_2025.geojson` | 369 GBA ward features | VERIFIED | Unchanged |
| `backend/migrations/004_ward_boundaries.sql` | wards DDL + 369 inserts | VERIFIED | Unchanged; column is ward_name TEXT NOT NULL |
| `backend/migrations/005_organizations.sql` | organizations table + FK columns | VERIFIED | Unchanged |

### Plan 01-02 Artifacts (regression check)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/models/ward.rs` | Ward and WardResponse structs | VERIFIED | Unchanged |
| `backend/src/models/organization.rs` | Organization and OrganizationResponse structs | VERIFIED | Unchanged |
| `backend/src/db/queries.rs` | get_ward_for_point() function | VERIFIED | Unchanged |
| `backend/src/db/admin_queries.rs` | list_admin_reports with correct wards.ward_name column | VERIFIED | Line 360: `wards.ward_name AS ward_name` |

### Plan 01-03 Artifacts (regression check)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/app/admin/lib/adminApi.ts` | listOrganizations(), assignUserOrg(), ward_name on AdminReport | VERIFIED | ward_name: string \| null |
| `frontend/app/admin/reports/page.tsx` | Ward name column + null guard | VERIFIED | setReports(res.data ?? []) |
| `frontend/app/admin/reports/map/page.tsx` | null guard on result.data | VERIFIED | setReports(result.data ?? []) |
| `frontend/app/admin/users/page.tsx` | Org assignment dropdown | VERIFIED | Unchanged |
| `frontend/app/admin/__tests__/reports-page-ward.test.tsx` | React tests for ward column | VERIFIED | 37 tests pass |

### Plan 01-05 Artifacts (gap closure — full verification)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/db/admin_queries.rs` | `wards.ward_name AS ward_name` in production SQL | VERIFIED | Line 360; commit 0356afc |
| `backend/src/db/admin_queries.rs` | Same correct column in unit test SQL | VERIFIED | Line 917; no occurrence of `wards.name AS ward_name` remains |

### Plan 01-06 Artifacts (gap closure — full verification)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/migrations/006_ward_org_scoping.sql` | wards.org_id UUID FK + index | VERIFIED | File exists; ALTER TABLE adds org_id UUID REFERENCES organizations(id) ON DELETE SET NULL; idx_wards_org_id created |
| `backend/src/models/admin.rs` | AdminUser struct with pub org_id: Option<Uuid> | VERIFIED | Line 76: `pub org_id: Option<Uuid>` with doc comment |
| `backend/src/db/admin_queries.rs` | org_id in AdminUserRow, ADMIN_USER_COLS, From conversion | VERIFIED | org_id in AdminUserRow (line 39), ADMIN_USER_COLS (line 73), From<AdminUserRow> mapping (line 55) |
| `backend/src/db/admin_queries.rs` | list_admin_reports with org_id parameter + recursive CTE | VERIFIED | Signature (line 312): `org_id: Option<Uuid>`; CTE appended at lines 318-331 when Some |
| `backend/src/db/admin_queries.rs` | count_admin_reports with org_id parameter + recursive CTE | VERIFIED | Signature (line 246): `org_id: Option<Uuid>`; CTE appended at lines 252-265 when Some |
| `backend/src/handlers/admin.rs` | admin_list_reports fetches org_id from DB via claims.sub | VERIFIED | Lines 412-417: Uuid::parse_str(claims.sub) → get_admin_user_by_id → org_id; passed to both queries at lines 429 and 438 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/migrations/004_ward_boundaries.sql` | `data/gba_wards_2025.geojson` | ST_GeomFromGeoJSON INSERTs | VERIFIED | 369 inserts; ward_name TEXT NOT NULL |
| `backend/src/handlers/reports.rs` | `backend/src/db/queries.rs` | get_ward_for_point before insert | VERIFIED | Wired; ST_Within spatial lookup |
| `backend/src/db/admin_queries.rs` | wards table | LEFT JOIN wards ON wards.id = reports.ward_id + SELECT wards.ward_name | VERIFIED | Line 360-361; correct column reference confirmed |
| `backend/src/handlers/admin.rs` | `backend/src/db/admin_queries.rs` | tokio::try_join!(list_admin_reports, count_admin_reports) both receiving org_id | VERIFIED | Lines 419-440; org_id passed to both branches |
| `backend/src/handlers/admin.rs` | admin_users table | get_admin_user_by_id(pool, admin_id) via claims.sub | VERIFIED | Lines 412-417; org_id extracted from AdminUser.org_id |
| `backend/src/db/admin_queries.rs` | organizations + wards tables | Recursive CTE org_subtree → wards.org_id when org_id is Some | VERIFIED | CTE in both list and count functions; wards.org_id FK via migration 006; bind(id) in both query chains |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WARD-01 | 01-01, 01-02, 01-03, 01-04, 01-05 | Reports auto-assigned to ward via PostGIS ST_Within; ward_name visible in admin triage queue | VERIFIED | Ward lookup wired at submission; `wards.ward_name AS ward_name` correct in list query (line 360); human verification needed for live spatial confirmation |
| WARD-02 | 01-01, 01-02 | organizations table stores GBA hierarchy as data with self-referential parent_id | VERIFIED | Table DDL correct; parent_id nullable FK; org_type CHECK; list/assign endpoints working |
| WARD-03 | 01-02, 01-03, 01-04, 01-06 | Each admin user assigned to org, controlling which reports they see | VERIFIED | Org assignment infrastructure complete (FK, endpoint, UI); org-scoped visibility implemented via recursive CTE; handler fetches org_id per-request from DB; zero results when wards.org_id is NULL (correct per STATE.md — GBA org structure unconfirmed) |
| WARD-04 | 01-01 | Ward boundary data imported into PostGIS as spatial source of truth | VERIFIED | 369 polygons in 004_ward_boundaries.sql with GEOMETRY(MULTIPOLYGON,4326), SRID constraint, GIST index |

**All four Phase 1 requirements are VERIFIED.**

---

## Anti-Patterns Found

No blocker or warning anti-patterns found in the files changed by Plans 05 and 06. The previous blocker (`wards.name AS ward_name`) is resolved. The 204 backend tests pass clean with no regressions.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None detected | — | — |

---

## Human Verification Required

### 1. Ward auto-assignment end-to-end (spatial)

**Test:** Start full stack with `docker compose up --build`. Submit a test report at Bengaluru center coordinates (lat 12.9716, lng 77.5946) via the citizen form. Log into admin dashboard and open the reports triage queue.
**Expected:** The submitted report shows a ward name (e.g. "Shivajinagar" or similar) in the Ward column, not "—".
**Why human:** Requires live PostGIS with wards table populated to execute ST_Within spatial query and JOIN. Cannot verify without a running database.

### 2. Org-scoped visibility with seeded data

**Test:** Seed the organizations table and populate wards.org_id for at least one ward office. Assign an admin user to that ward office org via PATCH /api/admin/users/:id/org. Log in as that admin and check the reports triage queue.
**Expected:** The org-scoped admin sees only reports whose ward_id corresponds to wards under their org's subtree. An admin with org_id=NULL sees all reports.
**Why human:** wards.org_id is NULL for all 369 wards until seeded (organizations table is intentionally empty — GBA structure unconfirmed per STATE.md). Org-scoped admins correctly see zero reports until seeding occurs. Cannot verify non-zero scoped behavior without out-of-band data seeding.

---

## Gaps Summary

No gaps remain. All 13 observable truths are verified at the code level. Plans 05 and 06 closed the two blockers that were open after the previous verification pass:

- **Gap 1 (WARD-01 triage surface):** The single wrong column reference `wards.name AS ward_name` has been corrected to `wards.ward_name AS ward_name` in both the production SQL (line 360) and the mirrored unit test SQL (line 917). Commit 0356afc. The `grep` confirms zero remaining occurrences of the wrong form.

- **Gap 2 (WARD-03 org-scoped visibility):** The full chain is now implemented and tested: `wards.org_id` FK added via migration 006; `AdminUser.org_id` field added; `list_admin_reports` and `count_admin_reports` accept `org_id: Option<Uuid>` and append a recursive CTE WHERE clause when Some; the `admin_list_reports` handler no longer discards claims — it parses `claims.sub`, fetches the admin user from DB, extracts `org_id`, and passes it to both query functions. Four new unit tests in admin_queries.rs validate the CTE inclusion/exclusion logic. Commits 7fd1eaf and cf63d7c.

Phase 1 goal is achieved. All ROADMAP.md Success Criteria are satisfied at the code level.

---

_Verified: 2026-03-12T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
