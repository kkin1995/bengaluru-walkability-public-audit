# Phase 3: Government Triage Workflow — Research (Revised)

**Researched:** 2026-05-25 (full revision; previous version dated 2026-03-14 pre-dates GBA pivot)
**Domain:** Rust/Axum backend (ENUM migration, multipart upload, org assignment, public report API) + Next.js 14 frontend (admin triage UI, status lifecycle, map pin colors, public single-report page) + PostgreSQL ward hierarchy data migration
**Confidence:** HIGH (stack patterns), MEDIUM (GBA engineering hierarchy — see D-45 / D-46 notes), MEDIUM (MLA names — 2023 Karnataka election results verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md — updated 2026-05-25)

### Locked Decisions

**GBA Meeting Outcome**
- D-01: GBA will NOT integrate. Nammadaari team administers all reports. No government-facing admin portal.
- D-02: Phase 3 goal: show citizens who is bureaucratically responsible for their ward; give Nammadaari admins full lifecycle + internal assignment workflow.

**Status Enum Migration**
- D-03: 6-value status enum: `open → acknowledged → assigned → in_progress → resolved → closed`
- D-04: Rename: `submitted → open`, `under_review → acknowledged`, `resolved → resolved` (kept)
- D-05: ALTER TYPE rename approach — no keep-old-plus-add-new
- D-06: Free transitions allowed — no enforced forward-only constraint
- D-07: Any admin (not super-admin only) can perform any status transition including Close

**Org Assignment (Internal Routing)**
- D-08: Org assignment for Nammadaari internal routing (tracking which corporation they coordinate with)
- D-09: Assigning a report to an org auto-advances status to `assigned`
- D-10: Assignment UI on report detail view only (`/admin/reports/[id]`)
- D-11: Org picker uses hierarchical cascade (Corporation first, then Ward Office)
- D-12: Researcher to seed placeholder GBA org structure — explicitly temporary

**Resolution Evidence**
- D-13: After-photo mandatory when transitioning to `resolved`
- D-14: After-photo mandatory when transitioning to `closed`
- D-15: Resolution notes optional at both Resolved and Closed
- D-16: Combined modal: status + optional notes + mandatory photo upload; single submit
- D-17: Resolution notes are admin-only (not public)
- D-18: Resolution after-photo is publicly visible on the public single-report page

**GBA Hierarchy — Data Source**
- D-19: All hierarchy data exists in `data/gba_wards_2025.geojson` (already partially loaded into `wards` table)
- D-20: 5 corporations already stored as TEXT in `wards.corporation`: Central, North, East, South, West
- D-21: Add hierarchy columns to `wards` table via migration 008: `zone_name`, `ro_division`, `aro_sub_division`, `assembly_constituency`, `assembly_constituency_no`, `parliamentary_constituency`, `mla_name`, `mp_name` — backfilled from GeoJSON + Vidhan Sabha/ECI data at migration time
- D-22: Corporation auto-derived at query time via JOIN `reports → wards` on `ward_id`

**GBA Hierarchy — Display**
- D-23: Show Engineering accountability chain AND elected chain per report
- D-24 (revised): Researcher tasks:
  1. Find BBMP/GBA Engineering Dept hierarchy for roads/footpaths (AEE → EE/DEE → SE → Chief Engineer) including how wards map to engineering sub-divisions
  2. Find current MLA names per Assembly Constituency from Karnataka Vidhan Sabha records
  3. Find current MP names per Lok Sabha constituency from ECI records
  4. Confirm whether `zone_name`/`ro_division`/`aro_sub_division` from GeoJSON appear in any official BBMP accountability/escalation path, or are purely geographic demarcation
- D-25: Display locations: admin detail page (full hierarchy), public map popup (corporation + ward + status + "Read More →"), public single-report page (full hierarchy + all report details)

**Parliamentary Constituency (MP)**
- D-41: Add `parliamentary_constituency` (TEXT) column to `wards` in migration 008, backfilled via `ac_no → Lok Sabha constituency` mapping from Delimitation Commission
- D-42: Elected chain display: `{ac_no} – {ac_name}` + MLA name + Parliamentary constituency + MP name

**Named Elected Officials**
- D-43: Add `mla_name` (TEXT) to `wards`. Seeded from Karnataka 2023 Vidhan Sabha results.
- D-44: Add `mp_name` (TEXT) to `wards`. Seeded from ECI 2024 Lok Sabha results.

**Engineering Accountability Chain**
- D-45: Engineering dept chain (AEE → EE/DEE → SE → Chief Engineer for Roads → GBA Commissioner). Research required — Plan 03-01 replanning blocked on this. See section below for research findings.
- D-46: `zone_name`/`ro_division`/`aro_sub_division` in GeoJSON are Revenue Officer zones — NOT engineering chain. Display role subject to research findings.

**Public Single-Report Page**
- D-26 through D-29: New public `/reports/[id]` page using Direction-A design system. Shows full report details, status history, hierarchy, after-photo. Status history either in existing `GET /api/reports/:id` or new endpoint (researcher recommends — see below).

**Public Map Status Display**
- D-30: Pin colors: Red = Open/Acknowledged/Assigned, Yellow/Amber = In Progress, Green = Resolved/Closed
- D-31 through D-33: Map popup adds corporation + ward + status + "Read More →" link

**Admin UI (Phase 02.5 Design System)**
- D-34: All new admin components use Direction-B primitives (Btn, Input, Select, Icon, CSS tokens from `admin.css`). No Tailwind.
- D-35: Frontend plans 03-03 and 03-04 BLOCKED on design team spec (design contract now provided in `03-UI-SPEC.md`)
- D-36: Backend plans 03-01 and 03-02 can proceed immediately

**StatusBadge Extension**
- D-37: Extend `STATUS_MAP` in `StatusBadge.tsx` to all 6 values
- D-38: New CSS tokens needed in `admin.css`: `--status-open`, `--status-acknowledged`, `--status-assigned`, `--status-in-progress`, `--status-closed` (+ `-bg` counterparts in both light + dark blocks)

**Phase Sequencing**
- D-39: Phase 02.6 ships first; Phase 3 starts on `feat/phase-03-government-triage`
- D-40: Branch: `feat/phase-03-government-triage` (already created, currently active)

### Claude's Discretion
- Exact Postgres ENUM rename migration syntax
- Admin detail page layout for status action buttons, org assignment, and hierarchy panel
- StatusBadge color tone choices (open/acknowledged → info/teal, assigned/in_progress → warn/amber, resolved/closed → accent/green and muted/grey)
- Resolution modal component details
- Whether status history goes in existing `GET /api/reports/:id` or a new endpoint

### Deferred Ideas (OUT OF SCOPE)
- GBA-facing admin portal
- Named officer lookup (changes too frequently)
- SMS/WhatsApp notifications to GBA officers
- Report social sharing
- Road network KML enrichment (deferred to Phase 4)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WFLOW-01 | Reports support 6-value status lifecycle: Open → Acknowledged → Assigned → In Progress → Resolved → Closed | ALTER TYPE rename syntax documented; `validate_status` is the extension point; migrate to Migration 008 |
| WFLOW-02 | Every status transition recorded in `status_history` with timestamp and acting admin user ID | `status_history` table already exists with all needed columns (report_id, new_status, changed_at, note, changed_by) |
| WFLOW-03 | Admin can assign a report to an organization (corporation or ward office) | `organizations` table exists; new `assigned_org_id` column on `reports`; `assign_report_org` DB function pattern documented |
| WFLOW-04 | Admin can add resolution notes when closing a report | Notes go on `reports.resolution_notes` (easy fetch) AND `status_history.note` (audit trail) |
| WFLOW-05 | Admin can upload a resolution photo when marking as Resolved | Multipart handler pattern verified from `create_report`; `resolution_photo_path` column on `reports` |
| MAP-01 | Public map pins color-coded by status | `ReportsMap.tsx` currently uses `CATEGORY_COLORS`; replace with `STATUS_COLORS` keyed by status |
| MAP-03 | Report status visible in popup when map pin clicked | Popup currently shows category/severity/description; add status label + corporation + "Read More →" link |
</phase_requirements>

---

## Summary

Phase 3 extends an already well-structured Rust/Axum + Next.js 14 codebase. Two major changes relative to the previous research (2026-03-14) are in scope following the GBA meeting on 2026-05-25:

**New in this revision:**
1. Migration 008 must also backfill `wards` table with 8 new hierarchy columns (`zone_name`, `ro_division`, `aro_sub_division`, `assembly_constituency`, `assembly_constituency_no`, `parliamentary_constituency`, `mla_name`, `mp_name`) derived from `data/gba_wards_2025.geojson` and seeded with verified MLA/MP names from 2023/2024 elections.
2. A new public single-report page (`/reports/[id]`) is required (Plan 03-04) showing full report details, status history timeline, GBA hierarchy display, and resolution after-photo.

The riskiest change remains the Postgres ENUM rename migration with its no-transaction pragma. The new risk in this revision is the large `UPDATE` backfill in migration 009 — updating 369 wards with hierarchy data should be done in migration 009 (separate from the ENUM changes in 008) to keep each migration atomic and reviewable.

The `GET /api/reports/:id` public endpoint already exists in `backend/src/handlers/reports.rs`. It needs to be extended to include: ward hierarchy data, status history array, and resolution photo URL. Recommendation: extend the existing endpoint (add `history` and `hierarchy` keys to response) rather than a new route — simpler routing, one client call from the public page.

**Primary recommendation:** Split into two migrations: 008 for ENUM rename + reports columns, 009 for wards hierarchy column addition + data backfill from GeoJSON. Implement in four plans: (1) DB migration + backend struct/validation updates, (2) resolve/assign-org handlers + public report API extension, (3) admin frontend triage panels, (4) public map + single-report page.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Status lifecycle enforcement | API / Backend | — | Validation happens server-side; `validate_status` pure fn guards all transitions |
| Resolution photo storage | API / Backend | CDN/Static (ServeDir) | Upload, EXIF-strip, write to `uploads_dir`; URL served by tower-http ServeDir |
| Org assignment internal routing | API / Backend | — | DB transaction: update `assigned_org_id` + advance status atomically |
| GBA hierarchy data | Database / Storage | API / Backend | Lives in `wards` table; JOIN at query time; API serializes for display |
| Status history audit trail | Database / Storage | API / Backend | Append-only `status_history` table; API queries for public timeline |
| Public map pin colors | Browser / Client | — | `STATUS_COLORS` map in `ReportsMap.tsx`; client-side lookup at render time |
| Public single-report page | Frontend Server (SSR) | Browser | Next.js 14 App Router — page can be server component calling API; no sensitive data |
| Admin triage panels | Browser / Client | API | Client components (useState for modal state); calls admin API routes with auth cookie |
| Status history for public page | API / Backend | — | Extend `GET /api/reports/:id` to include `history` array and `hierarchy` object |

---

## Standard Stack

### Core (already in use — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| axum | 0.7 | HTTP handler routing, multipart extractor | Already used for all endpoints |
| sqlx | 0.7 | Runtime SQL queries, transactions | Already used; runtime queries avoid compile-time DB requirement |
| react-leaflet | 4.2.1 | Map rendering, CircleMarker, Popup | Already used for public map |
| Next.js | 14.2.5 | App Router, dynamic imports, SSR disable | Already used |
| @testing-library/react | 14.3.1 | Component tests | Already used in all frontend tests |
| jest | 29.7.0 | Test runner (frontend) | Already configured |
| img-parts | 0.3 | EXIF stripping from JPEG bytes | Already in Cargo.toml, used in create_report |

### No New Dependencies Required

Phase 3 adds no new crate or npm dependencies. All capabilities needed are already in the project.

---

## GBA Hierarchy Research Findings

### D-24 Research Results: MLA Names (2023 Karnataka Election)

All 28 GBA assembly constituencies with their 2023 elected MLAs:

| AC No | AC Name | MLA | Party |
|-------|---------|-----|-------|
| 150 | Yelahanka | S R Vishwanath | BJP |
| 151 | K.R. Pura | B A Basavaraja | BJP |
| 152 | Byatarayanapura | Krishna Byregowda | Congress |
| 153 | Yeshwanthapura | S T Somashekar | BJP |
| 154 | Rajarajeshwarinagar | Munirathna | BJP |
| 155 | Dasarahalli | S Muniraju | BJP |
| 156 | Mahalakshmi Layout | K Gopalaiah | BJP |
| 157 | Malleshwaram | Dr C N Ashwathnarayan | BJP |
| 158 | Hebbal | Suresha B S | Congress |
| 159 | Pulakeshinagar | A C Srinivasa | Congress |
| 160 | Sarvagnanagar | K J George | Congress |
| 161 | C.V. Raman Nagar | S Raghu | BJP |
| 162 | Shivajinagar | Rizwan Arshad | Congress |
| 163 | Shanthinagar | N A Harris | Congress |
| 164 | Gandhinagara | Dinesh Gundu Rao | Congress |
| 165 | Rajajinagar | S Suresh Kumar | Congress |
| 166 | Govindraj Nagar | Priya Krishna | Congress |
| 167 | Vijayanagar | H R Gaviyappa | Congress |
| 168 | Chamrajapet | BZ Zameer Ahmed Khan | Congress |
| 169 | Chickpet | Uday B Garudachar | BJP |
| 170 | Basavanagudi | Ravi Subramanya L A | BJP |
| 171 | Padmanabanagar | R Ashoka | BJP |
| 172 | B.T.M Layout | Ramalinga Reddy | Congress |
| 173 | Jayanagar | C K Ramamurthy | BJP |
| 174 | Mahadevapura | Manjula S | BJP |
| 175 | Bommanahalli | Satish Reddy M | BJP |
| 176 | Bangalore South | M Krishnappa | BJP |
| 177 | Anekal | V Shivanna | Congress |

[CITED: bangalore.explocity.com/article/bangalore-city-mlas/ — 2023 Karnataka election results]

Note on AC name spelling: GeoJSON uses "Rajarajeshwarinagar" for AC 154 but "Rajajinagar" for AC 165. Explocity lists "Rajarajeshwarinagar" as "Munirathna (BJP)" and "Rajaji Nagar" as "S Suresh Kumar (Congress)". These are distinct constituencies — do not conflate.

### D-24 Research Results: MP Names (2024 Lok Sabha Election)

| Lok Sabha Constituency | AC Numbers Covered | MP (2024) | Party |
|------------------------|-------------------|-----------|-------|
| Bangalore North | 151, 152, 153, 155, 156, 157, 158, 159 | Kumari Shobha Karandlaje | BJP |
| Bangalore Central | 160, 161, 162, 163, 164, 165, 168, 174 | P.C. Mohan | BJP |
| Bangalore South | 166, 167, 169, 170, 171, 172, 173, 175 | Tejasvi Surya | BJP |
| Bangalore Rural | 150, 154, 176, 177 | Dr. C N Manjunath | BJP |

[CITED: en.wikipedia.org/wiki/Bangalore_North_Lok_Sabha_constituency — AC composition]
[CITED: en.wikipedia.org/wiki/Bangalore_Central_(Lok_Sabha_constituency) — AC composition]
[CITED: en.wikipedia.org/wiki/Bangalore_South_(Lok_Sabha_constituency) — AC composition]
[CITED: en.wikipedia.org/wiki/Bangalore_Rural_Lok_Sabha_constituency — AC composition]
[CITED: businesstoday.in 2024 Lok Sabha results — winning candidates confirmed]

**Coverage check:** AC 150 (Yelahanka) maps to Bangalore Rural (not Bangalore North as might be assumed from the zone name). This is verified from the Delimitation Commission mapping — Yelahanka is part of Bangalore Rural Lok Sabha along with Rajarajeshwarinagar (154), Bangalore South (176), and Anekal (177).

**Unaccounted AC:** Checking the mapping:
- ACs 150–177 = 28 ACs total
- Bangalore North: 151,152,153,155,156,157,158,159 = 8
- Bangalore Central: 160,161,162,163,164,165,168,174 = 8
- Bangalore South: 166,167,169,170,171,172,173,175 = 8
- Bangalore Rural: 150,154,176,177 = 4
- Total: 28 — all accounted for.

### D-45 Research Results: GBA Engineering Accountability Chain

**Research finding (MEDIUM confidence):** [CITED: site.bbmp.gov.in/departmentwebsites/Eng (SSL expired — indirect), search results citing GBA organization structure]

The GBA/BBMP engineering department for roads and footpaths uses a zone-based hierarchy distinct from the Revenue Officer (RO/ARO) zones in the GeoJSON:

```
Ward → AEE (Assistant Executive Engineer — sub-division level)
     → EE/DEE (Executive Engineer / Divisional Executive Engineer — division, typically ~2 zones)
     → SE (Superintending Engineer — corporation zone level)
     → Chief Engineer (per corporation — each of 5 corporations has 2 zones, each zone has Chief Engineer)
     → GBA Commissioner
```

**Key structural facts confirmed:**
- GBA has 10 zones (2 per corporation). The GeoJSON `zone_name` field corresponds to these 10 engineering zones.
- Each zone has a Chief Engineer (10 total across GBA).
- Each zone is divided into engineering divisions (mapped roughly to Assembly Constituencies — 28 ACs across 10 zones).
- AEEs handle specific sub-divisions within a division.

[CITED: deccanherald.com — "Greater Bengaluru Authority Finalises 10 Zonal Offices for New Corporations" — 2 zones per corporation confirmed]

**Implication for D-45:** The `zone_name` from GeoJSON (Rajarajeshwarinagar, Yelahanka, Bommanahalli, etc.) IS the engineering zone label — the same zones the GBA has formalized as 10 zonal offices. These are NOT just geographic/revenue demarcations; they are the functional accountability zones for roads/footpaths.

The recommended engineering chain display (per ward):
```
Ward → [AEE Sub-Division: aro_sub_division] → [EE Division: ro_division]
     → [SE Zone: zone_name] → Corporation Chief Engineer
     → GBA Commissioner
```

### D-46 Research Results: RO/ARO Fields — Are They Engineering or Revenue?

**Finding:** The GeoJSON fields `RO_Division` and `ARO_ Sub Division` appear to be Revenue Officer (RO/ARO) territorial divisions used for property tax administration, not engineering work order divisions. However, the geographic hierarchy they represent (`ARO sub-division < RO division < zone`) corresponds structurally to the engineering hierarchy (`AEE sub-division < EE division < SE zone`).

**Recommendation for display:** Use `aro_sub_division` as the lowest-level label and `ro_division` as the mid-level label in the engineering accountability chain, but label them accurately:
- `aro_sub_division` → label as "Sub-Division (AEE level)"
- `ro_division` → label as "Division (EE level)"  
- `zone_name` → label as "Zone (SE level)"

This provides useful geographic granularity for citizens without claiming the RO/ARO names are the exact engineering officer boundaries. [ASSUMED — the precise mapping of RO divisions to engineering EE divisions has not been verified against official BBMP engineering org charts due to SSL certificate expiry on site.bbmp.gov.in]

### Status of Migration 009 Backfill Data

From `data/gba_wards_2025.geojson` (verified from codebase — 369 features, all confirmed):

| Column | GeoJSON Source Field | Notes |
|--------|---------------------|-------|
| zone_name | `zone_name` | 10 unique values |
| ro_division | `RO_Division` | Note: field has "RO-" prefix in data |
| aro_sub_division | `ARO_ Sub Division` | Note: space in key name, "ARO-" prefix |
| assembly_constituency | `ac` | AC name string |
| assembly_constituency_no | `ac_no` | Integer string, cast to INT |
| parliamentary_constituency | Derived from `ac_no` mapping | See AC→Lok Sabha table above |
| mla_name | Seeded from research above | Keyed by `ac_no` |
| mp_name | Seeded from research above | Keyed by parliamentary_constituency |

The migration 009 backfill will use a large `UPDATE wards SET ... WHERE ward_number = ...` pattern or a CASE expression keyed on `ward_number` or `assembly_constituency_no`. The GeoJSON `ward_id` field contains the ward_number as a string (e.g., `"25"`).

---

## GBA Org Seed Data (Migration 010_org_seed.sql)

**Per D-12 (locked decision):** Researcher has supplied a placeholder GBA org structure based on publicly available 2025 GBA reorganization announcements. The `organizations` table is currently empty (per STATE.md). Plan 03-01 Task 4 creates `backend/migrations/010_org_seed.sql` that seeds this structure.

**Hierarchy to seed (6 rows minimum — 1 GBA + 5 zone rows; D-12 explicitly temporary; ward office rows can be added later when ground-truth GBA structure is confirmed):**

```
GBA (org_type='gba', parent_id=NULL)
├── Bengaluru Central Corporation        (org_type='corporation', parent_id=GBA.id)
├── Bengaluru North Corporation          (org_type='corporation', parent_id=GBA.id)
├── Bengaluru East Corporation           (org_type='corporation', parent_id=GBA.id)
├── Bengaluru South Corporation          (org_type='corporation', parent_id=GBA.id)
└── Bengaluru West Corporation           (org_type='corporation', parent_id=GBA.id)
```

These 5 corporation names align with the existing `wards.corporation` TEXT values (Central, North, East, South, West) per D-20 — the seed migration uses the formal "Bengaluru {X} Corporation" display name while the wards table continues to use the short directional label. OrgAssignPanel cascade (D-11) will filter wards by matching `org.name` prefix against `ward.corporation`.

**Recommended SQL pattern (CTE chain — avoids two-pass UUID lookup):**

```sql
-- 010_org_seed.sql
-- Per D-12: placeholder GBA org structure based on publicly available GBA 2025 info.
-- Update with ground-truth IDs once GBA structure is confirmed.
WITH gba AS (
  INSERT INTO organizations (id, name, org_type, parent_id)
  VALUES (gen_random_uuid(), 'GBA', 'gba', NULL)
  RETURNING id
)
INSERT INTO organizations (id, name, org_type, parent_id)
SELECT gen_random_uuid(), name, 'corporation', gba.id
FROM gba, (VALUES
  ('Bengaluru Central Corporation'),
  ('Bengaluru North Corporation'),
  ('Bengaluru East Corporation'),
  ('Bengaluru South Corporation'),
  ('Bengaluru West Corporation')
) AS c(name);
```

**Idempotency note:** Migration 010 is run exactly once by sqlx::migrate! at startup. If re-applied accidentally (e.g., on a fresh DB), the CTE inserts again — but `organizations.id` is unique on UUID and there is no UNIQUE constraint on `name`, so re-application would produce duplicate rows. To prevent: add `WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE org_type='gba')` guard before each INSERT. Plan 03-01 Task 4 must include this guard.

**Ward office rows: out of scope for migration 010.** GBA has not finalized ward office boundaries as of 2026-05-25. The cascade picker (D-11) will show the 5 corporations as the only assignable orgs at this phase; ward offices can be seeded in a follow-up migration once confirmed.

---

## Architecture Patterns

### Recommended Project Structure for Phase 3 Changes

```
backend/
├── migrations/
│   ├── 008_workflow.sql    ← ENUM rename + new reports columns (no-transaction)
│   └── 009_ward_hierarchy.sql ← ADD columns to wards + backfill from GBA data
├── src/
│   ├── handlers/
│   │   ├── admin.rs        ← extend validate_status + add resolve/assign handlers
│   │   └── reports.rs      ← extend get_report to include hierarchy + status history
│   ├── db/
│   │   ├── admin_queries.rs ← add resolve_report, assign_report_org, update stats seed
│   │   └── queries.rs      ← add get_report_with_hierarchy fn
│   └── models/
│       └── report.rs       ← add resolution_photo_path, resolution_notes, assigned_org_id

frontend/app/
├── admin/
│   ├── components/
│   │   ├── StatusBadge.tsx  ← extend STATUS_MAP to 6 values + update CSS tokens
│   │   ├── StatusActionPanel.tsx ← NEW: contextual action buttons per status
│   │   ├── OrgAssignPanel.tsx    ← NEW: cascading corporation→ward_office selector
│   │   └── ResolveModal.tsx      ← NEW: combined modal (status + notes + mandatory photo)
│   ├── reports/[id]/
│   │   └── page.tsx         ← add StatusActionPanel, OrgAssignPanel, HierarchyPanel
│   └── lib/
│       └── adminApi.ts      ← extend AdminReport, add resolveReport + assignReportOrg
├── reports/
│   └── [id]/
│       └── page.tsx         ← NEW: public single-report page (Direction-A)
└── components/
    └── ReportsMap.tsx       ← replace CATEGORY_COLORS with STATUS_COLORS + popup update
```

### Pattern 1: Two-Migration Split — ENUM + Ward Hierarchy

**Why split:** Migration 008 needs `-- no-transaction` because `ALTER TYPE ADD VALUE` cannot run inside a transaction. Migration 009 (UPDATE backfill of 369 wards) can and should run inside a transaction for atomicity. Keeping them separate keeps each migration's intent clear and independently rollback-able.

**Migration 008 (no-transaction):**
```sql
-- no-transaction
-- Rationale: ALTER TYPE ADD VALUE cannot run inside a transaction block

ALTER TYPE report_status RENAME VALUE 'submitted'   TO 'open';
ALTER TYPE report_status RENAME VALUE 'under_review' TO 'acknowledged';
-- 'resolved' unchanged

ALTER TYPE report_status ADD VALUE 'assigned'    AFTER 'acknowledged';
ALTER TYPE report_status ADD VALUE 'in_progress' AFTER 'assigned';
ALTER TYPE report_status ADD VALUE 'closed'      AFTER 'resolved';

DROP INDEX IF EXISTS idx_reports_submitted_created;
CREATE INDEX idx_reports_submitted_created ON reports(created_at DESC) WHERE status = 'open';

ALTER TABLE reports
  ADD COLUMN resolution_photo_path TEXT,
  ADD COLUMN resolution_notes      TEXT,
  ADD COLUMN assigned_org_id       UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX idx_reports_assigned_org ON reports(assigned_org_id)
  WHERE assigned_org_id IS NOT NULL;
```

**Migration 009 (standard transaction — ward hierarchy):**
```sql
-- 009_ward_hierarchy.sql
-- Adds hierarchy columns to wards table and backfills from GBA 2025 data

ALTER TABLE wards
  ADD COLUMN zone_name                TEXT,
  ADD COLUMN ro_division              TEXT,
  ADD COLUMN aro_sub_division         TEXT,
  ADD COLUMN assembly_constituency    TEXT,
  ADD COLUMN assembly_constituency_no INT,
  ADD COLUMN parliamentary_constituency TEXT,
  ADD COLUMN mla_name                 TEXT,
  ADD COLUMN mp_name                  TEXT;

-- Backfill from GeoJSON-derived data using ward_number as key
-- (369 UPDATE statements generated from gba_wards_2025.geojson)
-- Pattern: UPDATE wards SET zone_name = '...', ro_division = '...', ...
--          WHERE ward_number = N;
-- OR: a single UPDATE with a large CASE expression keyed on ward_number

-- After column backfill, add indexes for common query patterns
CREATE INDEX idx_wards_assembly_constituency_no ON wards(assembly_constituency_no);
CREATE INDEX idx_wards_parliamentary_constituency ON wards(parliamentary_constituency);
CREATE INDEX idx_wards_zone_name ON wards(zone_name);
```

**Implementation note for 009 backfill:** The planner should choose one of two approaches:
- Option A (369 individual UPDATE statements): easy to generate from a Python/jq script iterating the GeoJSON; each ward is updated independently. Recommended for legibility.
- Option B (CASE expression): single UPDATE wards SET zone_name = CASE WHEN ward_number = 25 THEN 'Rajarajeshwarinagar' ... END. Compact but hard to read.

Option A is preferred — it matches the style of migration 004 which used individual INSERT statements for each ward.

### Pattern 2: Postgres ENUM Rename + No-Transaction Pragma

**Verified pattern (same as original RESEARCH.md):**
- `ALTER TYPE report_status RENAME VALUE` is safe in Postgres 10+ (project uses PostGIS → Postgres 12+)
- `ALTER TYPE ... ADD VALUE` cannot be inside BEGIN/COMMIT — use `-- no-transaction` as first non-empty line
- Partial index `idx_reports_submitted_created` has predicate `WHERE status = 'submitted'` — must DROP and recreate with `WHERE status = 'open'` or queries on 'open' reports may miss the index

### Pattern 3: Resolution Photo Upload via Multipart

Same as original research — verified from `create_report` handler:
- Use `axum::extract::Multipart` extractor
- Collect ALL fields before validation (multipart fields consumed in order)
- Apply `strip_exif` before disk write
- UUID-based filename: `format!("{}.jpg", Uuid::new_v4())`
- Store only filename in `resolution_photo_path` column (not full path)
- Validate photo presence AFTER collecting all fields
- Do NOT manually set `Content-Type` on FormData fetch — browser sets boundary automatically

### Pattern 4: Extending GET /api/reports/:id for Public Report Page

**Decision (D-29): Extend existing endpoint, not a new route.**

Current `get_report_by_id` in `backend/src/db/queries.rs` (line 185) fetches `Report` struct from `reports` table. For the public single-report page, extend the public `GET /api/reports/:id` handler to return an enriched response including:
1. The existing `ReportResponse` fields
2. `status_history: Vec<StatusHistoryEntry>` — array of `{ status, changed_at }` (public fields only; no `note` or `changed_by` in public response)
3. `ward_hierarchy: WardHierarchy` — object with `zone_name`, `assembly_constituency`, `assembly_constituency_no`, `parliamentary_constituency`, `mla_name`, `mp_name`, and the engineering chain fields

This avoids a second API call from the public page. Pattern: a new `get_report_with_detail` function in `backend/src/db/queries.rs` that does a JOIN with `wards` and a sub-select for status history.

```rust
// In backend/src/db/queries.rs — new function for public report detail
pub async fn get_report_with_detail(
    pool: &PgPool,
    id: Uuid,
    api_base: &str,
) -> Result<serde_json::Value, AppError> {
    // 1. Fetch report + ward hierarchy via JOIN
    let report_row = sqlx::query(r#"
        SELECT
            r.id, r.created_at, r.image_path, r.latitude, r.longitude,
            r.category::TEXT AS category, r.severity::TEXT AS severity,
            r.description, r.status::TEXT AS status,
            r.location_source::TEXT AS location_source,
            r.resolution_photo_path, r.resolution_notes,
            w.ward_name, w.corporation,
            w.zone_name, w.ro_division, w.aro_sub_division,
            w.assembly_constituency, w.assembly_constituency_no,
            w.parliamentary_constituency, w.mla_name, w.mp_name
        FROM reports r
        LEFT JOIN wards w ON w.id = r.ward_id
        WHERE r.id = $1
    "#)
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    // 2. Fetch public status history (no note, no changed_by)
    let history_rows = sqlx::query(
        "SELECT new_status::TEXT AS status, changed_at
         FROM status_history WHERE report_id = $1 ORDER BY changed_at ASC"
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    // 3. Compose response JSON
    Ok(serde_json::json!({ /* ... */ }))
}
```

### Pattern 5: Status-Based Pin Colors in ReportsMap

```typescript
// In ReportsMap.tsx — replaces CATEGORY_COLORS as the source for CircleMarker fillColor
const STATUS_COLORS: Record<string, string> = {
  open:         "#ef4444", // red
  acknowledged: "#ef4444", // red — pre-action, same as open
  assigned:     "#ef4444", // red — assigned but not yet in progress
  in_progress:  "#f59e0b", // amber
  resolved:     "#22c55e", // green
  closed:       "#22c55e", // green — archived, same visual as resolved
};

// Usage in CircleMarker:
// fillColor={STATUS_COLORS[report.status] ?? "#ef4444"}
```

### Pattern 6: StatusBadge 6-Value Extension

New CSS tokens needed in `admin.css` (both `.admin-portal` light and `.dark .admin-portal` dark blocks):

```css
/* In .admin-portal light block */
--status-open:           oklch(0.56 0.13 200);   /* teal — same as submitted */
--status-open-bg:        oklch(0.95 0.03 200);
--status-acknowledged:   oklch(0.56 0.13 200);   /* teal — same as open */
--status-acknowledged-bg: oklch(0.95 0.03 200);
--status-assigned:       oklch(0.70 0.15 70);    /* amber — same as warn */
--status-assigned-bg:    oklch(0.96 0.04 70);
--status-in-progress:    oklch(0.70 0.15 70);    /* amber — same as assigned */
--status-in-progress-bg: oklch(0.96 0.04 70);
--status-closed:         oklch(0.50 0.01 220);   /* muted grey */
--status-closed-bg:      oklch(0.94 0.005 220);
/* --status-resolved already defined in admin.css */
```

`STATUS_MAP` in `StatusBadge.tsx` entry for each of the 6 values follows the color-to-tone mapping in D-37/D-38:
- `open` → tone: "info" (teal)
- `acknowledged` → tone: "info" (teal)
- `assigned` → tone: "warn" (amber)
- `in_progress` → tone: "warn" (amber)
- `resolved` → tone: "accent" (green — already exists as `--status-resolved`)
- `closed` → tone: "muted" (grey — new `--status-closed`)

### Pattern 7: Cascading Org Selector (unchanged from original research)

```typescript
// Pure React cascading select pattern — uses existing Organization[] from listOrganizations()
const corporations = orgs.filter(o => o.org_type === 'corporation');
const wardOffices  = selectedCorpId
  ? orgs.filter(o => o.org_type === 'ward_office' && o.parent_id === selectedCorpId)
  : [];
// Final assigned_org_id: ward_office ID if selected, else corporation ID
```

### Anti-Patterns to Avoid

- **JSON body for the resolve endpoint:** Resolution photo requires multipart. Do NOT use `Json<payload>`.
- **Storing full path in DB:** Store only filename in `resolution_photo_path`, not full absolute path.
- **Running ADD VALUE inside a transaction:** Use `-- no-transaction` pragma in 008.
- **Forgetting validate_status update:** Pure fn in `admin.rs` still rejects new values until updated.
- **Forgetting get_report_stats seed list:** Must update from 3 keys to 6 keys.
- **Map legend not updated:** After pin colors switch to status-based, update the legend in `map/page.tsx`.
- **Migration 008 and 009 in same file:** 008 needs `-- no-transaction`; 009 should run in a transaction for atomicity. Split is required.
- **`wards` table ward_number vs ward_id:** GeoJSON `ward_id` field contains ward_number as string. The DB `wards` table uses its own UUID `id` field. Match GeoJSON to DB rows via `ward_number` column.
- **RO/ARO labels misleading users:** Don't display `RO_Division` as "Engineering Division" — it is a Revenue Officer zone. Label accurately as described in D-46 recommendation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload parsing | Custom multipart parser | Axum's `Multipart` extractor | Already proven in `create_report` |
| EXIF stripping | Custom JPEG byte parser | `img-parts` crate | Already used in `create_report` |
| Path traversal guard | Manual string matching | `std::fs::canonicalize` + `starts_with` | Already used in `admin_delete_report` |
| Org tree traversal | Recursive JS tree walk | SQL recursive CTE | Pattern already in `count_admin_reports` |
| Status audit trail | New audit table | Extend `update_report_status` transaction | `status_history` table already exists |
| Ward hierarchy JOIN | Denormalizing corporation onto reports | JOIN `reports → wards` at query time | D-22: no denormalized corporation column |
| GBA data file parsing | Runtime GeoJSON parsing | Migration SQL backfill | One-time data migration at deploy time |

---

## Common Pitfalls

### Pitfall 1: ALTER TYPE ADD VALUE Cannot Run in a Transaction
**What goes wrong:** sqlx wraps each migration in `BEGIN ... COMMIT` by default. `ALTER TYPE ... ADD VALUE` fails with "ALTER TYPE ... ADD VALUE cannot run inside a transaction block."
**How to avoid:** `-- no-transaction` as first non-empty line of `008_workflow.sql`.

### Pitfall 2: Partial Index References Old Enum String Literal
**What goes wrong:** `idx_reports_submitted_created` predicate references `status = 'submitted'`. After rename, queries on `status = 'open'` may miss the index.
**How to avoid:** DROP and recreate the index with `WHERE status = 'open'` in migration 008.

### Pitfall 3: validate_status Not Updated
**What goes wrong:** After migration, PATCH requests with `status = "open"` return 400 because `validate_status` still only accepts `submitted | under_review | resolved`.
**How to avoid:** Update match arms to all 6 new values in the same wave as the migration.

### Pitfall 4: Stats Map Seeding Stale Keys
**What goes wrong:** `get_report_stats` seeds hard-coded `["submitted", "under_review", "resolved"]` — after rename, these keys show 0 and new keys don't appear.
**How to avoid:** Update seed array to `["open", "acknowledged", "assigned", "in_progress", "resolved", "closed"]`.

### Pitfall 5: Map Legend Shows Category Colors After Switch to Status Colors
**What goes wrong:** `map/page.tsx` has a category-based legend. After pin colors switch to status-based, legend misleads citizens.
**How to avoid:** Update legend in the same wave as `ReportsMap.tsx` changes.

### Pitfall 6: Resolution Photo URL Missing from Public API
**What goes wrong:** Public `ReportResponse` has no `resolution_photo_url` — popup and public report page cannot display after-photo.
**How to avoid:** Add `resolution_photo_url: Option<String>` to `ReportResponse`; populate from `resolution_photo_path` in `into_response()`.

### Pitfall 7: Multipart Field Order Dependency
**What goes wrong:** Axum multipart reads fields sequentially — cannot re-read. Validation before collecting all fields loses photo bytes.
**How to avoid:** Collect ALL fields into a local struct before any validation.

### Pitfall 8: Migration 009 Ward_number vs Ward_id Confusion
**What goes wrong:** GeoJSON `ward_id` property is the ward number (integer string), NOT the UUID `id` in the `wards` table. Joining on the wrong field produces zero backfill updates.
**How to avoid:** Always match GeoJSON `ward_id` to DB `wards.ward_number` (not `wards.id`).

### Pitfall 9: Missing wards JOIN in Public Report API Response
**What goes wrong:** `GET /api/reports/:id` currently fetches from `reports` only (no JOIN with `wards`). Extending it for hierarchy requires adding `LEFT JOIN wards ON w.id = r.ward_id` — if forgotten, all hierarchy fields are null.
**How to avoid:** The extended `get_report_with_detail` function must include the LEFT JOIN.

### Pitfall 10: Status History for Public Page Exposes Admin Data
**What goes wrong:** `status_history` has `note` (resolution notes, admin-only per D-17) and `changed_by` (admin user UUID). Including these in the public API response violates D-17.
**How to avoid:** Public status history query selects ONLY `new_status::TEXT AS status, changed_at` — no `note`, no `changed_by`.

---

## Code Examples

### Backend: validate_status Updated

```rust
// In admin.rs — updated pure function, same signature
pub fn validate_status(status: &str) -> Result<(), AppError> {
    match status {
        "open" | "acknowledged" | "assigned" | "in_progress" | "resolved" | "closed" => Ok(()),
        _ => Err(AppError::BadRequest("Invalid status".to_string())),
    }
}
```

### Backend: resolve_report DB Function

```rust
// In admin_queries.rs
pub async fn resolve_report(
    pool: &PgPool,
    report_id: Uuid,
    new_status: &str,               // "resolved" or "closed"
    resolution_photo_path: &str,
    resolution_notes: Option<&str>,
    changed_by: Uuid,
) -> Result<bool, AppError> {
    let mut tx = pool.begin().await?;
    let result = sqlx::query(r#"
        UPDATE reports
        SET status = $1::report_status,
            resolution_photo_path = $2,
            resolution_notes = $3
        WHERE id = $4"#)
    .bind(new_status).bind(resolution_photo_path).bind(resolution_notes).bind(report_id)
    .execute(&mut *tx).await?;
    if result.rows_affected() == 0 { tx.rollback().await?; return Ok(false); }
    sqlx::query(
        "INSERT INTO status_history (report_id, new_status, note, changed_by)
         VALUES ($1, $2::report_status, $3, $4)")
    .bind(report_id).bind(new_status).bind(resolution_notes).bind(changed_by)
    .execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(true)
}
```

### Backend: assign_report_org DB Function

```rust
// In admin_queries.rs
pub async fn assign_report_org(
    pool: &PgPool, report_id: Uuid, org_id: Uuid, changed_by: Uuid,
) -> Result<bool, AppError> {
    let mut tx = pool.begin().await?;
    let result = sqlx::query(
        "UPDATE reports SET assigned_org_id = $1, status = 'assigned'::report_status WHERE id = $2")
    .bind(org_id).bind(report_id).execute(&mut *tx).await?;
    if result.rows_affected() == 0 { tx.rollback().await?; return Ok(false); }
    sqlx::query(
        "INSERT INTO status_history (report_id, new_status, note, changed_by)
         VALUES ($1, 'assigned'::report_status, 'Assigned to organization', $2)")
    .bind(report_id).bind(changed_by).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(true)
}
```

### Frontend: AdminReport Interface Extended

```typescript
// In adminApi.ts — extend AdminReport
export interface AdminReport {
  // ... existing fields ...
  resolution_photo_url: string | null;   // publicly visible
  resolution_notes: string | null;       // admin-only display
  assigned_org_id: string | null;        // UUID of assigned org
}

// Extend AdminStats
export interface AdminStats {
  total_reports: number;
  by_status: {
    open: number; acknowledged: number; assigned: number;
    in_progress: number; resolved: number; closed: number;
  };
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
}
```

### Frontend: resolveReport API Function (multipart)

```typescript
export async function resolveReport(
  id: string,
  status: "resolved" | "closed",
  photo: File,
  notes?: string
): Promise<AdminReport> {
  const form = new FormData();
  form.append("status", status);
  form.append("resolution_photo", photo);
  if (notes) form.append("resolution_notes", notes);
  // Do NOT set Content-Type manually
  const res = await fetch(`${BASE}/api/admin/reports/${id}/resolve`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

### New Routes to Register in main.rs

```rust
// In admin_protected_router:
.route("/api/admin/reports/:id/resolve",    post(admin_resolve_report))
.route("/api/admin/reports/:id/assign-org", post(admin_assign_report_org))
// Existing PATCH /api/admin/reports/:id/status remains for non-photo transitions
```

### GBA Org Seed Data (Migration 010_org_seed.sql)

See the dedicated `## GBA Org Seed Data (Migration 010_org_seed.sql)` section above for the full seeded hierarchy (6 rows minimum — 1 GBA + 5 corporations) and the canonical CTE pattern Plan 03-01 Task 4 implements. Migration 010 is its own file (separate from 009 schema changes) per the recommendation that data seeding stays separate from schema changes.

---

## Migration 009: AC→Lok Sabha Mapping (Complete)

The hardcoded mapping for D-41 (parliamentary_constituency backfill):

```sql
-- ac_no → parliamentary_constituency mapping (Delimitation Commission of India)
-- 150: Yelahanka → Bangalore Rural
-- 151: K.R. Pura → Bangalore North
-- 152: Byatarayanapura → Bangalore North
-- 153: Yeshwanthapura → Bangalore North
-- 154: Rajarajeshwarinagar → Bangalore Rural
-- 155: Dasarahalli → Bangalore North
-- 156: Mahalakshmi Layout → Bangalore North
-- 157: Malleshwaram → Bangalore North
-- 158: Hebbal → Bangalore North
-- 159: Pulakeshinagar → Bangalore North
-- 160: Sarvagnanagar → Bangalore Central
-- 161: C.V. Raman Nagar → Bangalore Central
-- 162: Shivajinagar → Bangalore Central
-- 163: Shanthinagar → Bangalore Central
-- 164: Gandhinagara → Bangalore Central
-- 165: Rajajinagar → Bangalore Central
-- 166: Govindraj Nagar → Bangalore South
-- 167: Vijayanagar → Bangalore South
-- 168: Chamrajapet → Bangalore Central
-- 169: Chickpet → Bangalore South
-- 170: Basavanagudi → Bangalore South
-- 171: Padmanabanagar → Bangalore South
-- 172: B.T.M Layout → Bangalore South
-- 173: Jayanagar → Bangalore South
-- 174: Mahadevapura → Bangalore Central
-- 175: Bommanahalli → Bangalore South
-- 176: Bangalore South → Bangalore Rural
-- 177: Anekal → Bangalore Rural
```

And the corresponding MP names:
```
Bangalore North → Kumari Shobha Karandlaje
Bangalore Central → P.C. Mohan
Bangalore South → Tejasvi Surya
Bangalore Rural → Dr. C N Manjunath
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| 3-value status enum (submitted/under_review/resolved) | 6-value enum (open/acknowledged/assigned/in_progress/resolved/closed) | Richer triage for Nammadaari team |
| Category-colored map pins | Status-colored pins | Citizens see resolution progress |
| No resolution evidence | Mandatory after-photo on resolved/closed | Accountability: cannot close without photographic proof |
| Status transitions via JSON PATCH | Resolve/close via multipart POST | Supports file upload with text in one request |
| wards table: id, ward_number, ward_name, corporation, boundary | + zone_name, ro_division, aro_sub_division, assembly_constituency, assembly_constituency_no, parliamentary_constituency, mla_name, mp_name | Citizens can see who is responsible for their ward |
| No public report detail page | New /reports/[id] with hierarchy | Citizens can share, bookmark, verify status of specific reports |

---

## Open Questions (RESOLVED)

1. **Migration 009 backfill strategy: 369 UPDATE statements vs CASE expression**
   - Recommendation: Generate 369 individual UPDATE statements (one per ward), keyed on `ward_number`. Matches the style of migration 004 (individual INSERTs). A Python script from the GeoJSON is the appropriate generation tool.

2. **GBA org seed — separate migration 010 or inline in 009?**
   - Recommendation: Add a `010_org_seed.sql` migration with the placeholder GBA→Corporation→WardOffice structure. Keeps data seeding separate from schema changes. Mark all rows with a `-- PLACEHOLDER` comment per D-12.

3. **Status history for public page — inline in GET /api/reports/:id vs new endpoint**
   - Recommendation: Extend the existing `GET /api/reports/:id` endpoint to include `history` and `ward_hierarchy` in the response body. Avoids a second client roundtrip from the public report page. The admin `GET /api/admin/reports/:id` endpoint remains separate and includes admin-only fields.

4. **Public single-report page — server component vs client component**
   - Recommendation: Server component (Next.js App Router default). The public report page has no interactive state beyond the back-navigation link. Server-side fetch of `GET /api/reports/:id` is simpler, avoids loading spinners, and allows the page to be SEO-indexed and shareable. Use `INTERNAL_API_URL` env var for server-side fetch (matches existing pattern in `frontend/app/lib/config.ts`).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Frontend) | Jest 29.7.0 + @testing-library/react 14.3.1 |
| Framework (Backend) | Rust built-in (`cargo test`) |
| Config file (Frontend) | `frontend/jest.config.js` |
| Quick run (Frontend) | `cd frontend && npm test -- --passWithNoTests` |
| Full suite (Frontend) | `cd frontend && npm test` |
| Quick run (Backend) | `cd backend && cargo test` |
| Full suite (Backend) | `cd backend && cargo test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WFLOW-01 | `validate_status` accepts all 6 new values | unit (backend) | `cd backend && cargo test test_validate_status` | ❌ Wave 0 — rewrite |
| WFLOW-01 | `validate_status` rejects old 3 names | unit (backend) | `cd backend && cargo test test_validate_status` | ❌ Wave 0 |
| WFLOW-02 | Status history row inserted per transition | manual via docker-compose | — | Covered by existing update_report_status pattern |
| WFLOW-03 | `assignReportOrg` API fn sends correct payload | unit (frontend) | `cd frontend && npm test -- --testPathPattern=adminApi` | ❌ Wave 0 |
| WFLOW-03 | OrgAssignPanel renders corporation dropdown | unit (frontend) | `cd frontend && npm test -- --testPathPattern=OrgAssignPanel` | ❌ Wave 0 |
| WFLOW-04 | ResolveModal renders notes textarea (optional) | unit (frontend) | `cd frontend && npm test -- --testPathPattern=ResolveModal` | ❌ Wave 0 |
| WFLOW-05 | ResolveModal submit disabled without photo | unit (frontend) | `cd frontend && npm test -- --testPathPattern=ResolveModal` | ❌ Wave 0 |
| WFLOW-05 | Pure validation: missing photo for resolved/closed → BadRequest | unit (backend) | `cd backend && cargo test test_validate_resolve` | ❌ Wave 0 |
| MAP-01 | ReportsMap CircleMarker uses STATUS_COLORS not category color | unit (frontend) | `cd frontend && npm test -- --testPathPattern=ReportsMap` | ❌ Wave 0 |
| MAP-03 | Popup renders status label text | unit (frontend) | `cd frontend && npm test -- --testPathPattern=ReportsMap` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `backend/src/handlers/admin.rs` — `validate_status` test module: rewrite to cover 6 new values, reject renamed values
- [ ] `frontend/app/admin/components/__tests__/ResolveModal.test.tsx` — NEW: photo requirement, notes textarea, submit state
- [ ] `frontend/app/admin/components/__tests__/OrgAssignPanel.test.tsx` — NEW: corporation dropdown, ward office filter
- [ ] `frontend/app/admin/components/__tests__/StatusActionPanel.test.tsx` — NEW: buttons per status state
- [ ] `frontend/app/components/__tests__/ReportsMap.test.tsx` — EXISTING: add STATUS_COLORS + popup status label tests
- [ ] `frontend/app/reports/[id]/__tests__/page.test.tsx` — NEW (or no unit test if server component — integration test instead)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL + PostGIS | Migration 008/009 | ✓ | 15.x (docker-compose) | — |
| Docker + docker compose | DB for migration apply | ✓ | docker compose v2 | — |
| cargo sqlx prepare | Offline metadata regen | ✓ | sqlx-cli via cargo | — |
| Node.js 20 | Frontend build/test | ✓ | 20.x | — |

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes — all new admin routes | `require_auth` middleware (existing pattern) |
| V4 Access Control | yes — resolve/assign endpoints | D-07: any admin can act; `require_auth` sufficient |
| V5 Input Validation | yes — status, photo, notes | `validate_status` pure fn; `img-parts` EXIF strip; multipart field collection before validation |
| V6 Cryptography | no | No new crypto — existing Argon2id unchanged |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Admin status tampering | Tampering | `validate_status` rejects unknown values; sqlx parameterized queries prevent injection |
| Path traversal in resolution photo filename | Tampering | UUID-generated filenames; `canonicalize` + `starts_with` check (existing pattern from `admin_delete_report`) |
| Skipping resolution photo requirement | Tampering | Validation: if `new_status in [resolved, closed]` and `photo_bytes.is_empty()` → 400 BadRequest |
| Admin-only fields (notes) leaking to public | Information Disclosure | `status_history.note` excluded from public status history query (selects only `new_status, changed_at`) |
| Public report page leaking submitter identity | Information Disclosure | `get_report_with_detail` uses same `ReportResponse` struct pattern — `submitter_name`, `submitter_contact`, `submitter_ip` never included |
| Org assignment to nonexistent org | Tampering | FK constraint on `assigned_org_id` references `organizations(id)` — DB enforces referential integrity; handler validates org exists before calling `assign_report_org` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `zone_name` in GeoJSON corresponds to GBA's 10 engineering zones (not just geographic labels) | GBA Hierarchy Research D-45 | If wrong, the engineering chain display would misassign zones; display would still be useful as geographic context |
| A2 | `ro_division` / `aro_sub_division` from GeoJSON structurally correspond to EE divisions / AEE sub-divisions | D-46 recommendation | If wrong, labels would mislead users about engineering accountability; risk mitigated by labeling as "Division" / "Sub-Division" not as "EE" / "AEE" |
| A3 | MLA names from 2023 Karnataka election are current (no by-elections in any of the 28 GBA constituencies since May 2023) | MLA table above | Minor: if wrong, a name would be stale; updated manually after Karnataka state elections (every ~5 years per D-43) |
| A4 | MP names from 2024 Lok Sabha election are current (no by-elections in Bangalore North/Central/South/Rural since June 2024) | MP table above | Minor: if wrong, a name would be stale; updated manually after general elections (every ~5 years per D-44) |
| A5 | AC 150 (Yelahanka) is part of Bangalore Rural Lok Sabha (not Bangalore North) | AC→Lok Sabha mapping | If wrong, Yelahanka ward reports would show wrong MP; the Wikipedia source is authoritative for Delimitation Commission mapping |

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `backend/src/db/admin_queries.rs` — `update_report_status`, `list_admin_reports`, `get_report_stats`
- Direct codebase inspection: `backend/src/handlers/admin.rs` — `validate_status`, multipart context
- Direct codebase inspection: `backend/src/db/queries.rs` — `get_report_by_id` (public endpoint, line 185)
- Direct codebase inspection: `backend/src/main.rs` — route registration (lines 171–216)
- Direct codebase inspection: `backend/migrations/001_init.sql` through `007_anti_abuse.sql` — current schema
- Direct codebase inspection: `data/gba_wards_2025.geojson` — 369 features, all 28 ACs confirmed
- Direct codebase inspection: `frontend/app/components/ReportsMap.tsx` — current pin color pattern
- Direct codebase inspection: `frontend/app/admin/components/StatusBadge.tsx`, `Select.tsx`, `admin.css`
- Direct codebase inspection: `frontend/app/admin/lib/adminApi.ts` — interface shapes
- Direct codebase inspection: `.planning/phases/03-government-triage-workflow/03-CONTEXT.md` — all decisions D-01 through D-46
- [CITED: en.wikipedia.org/wiki/Bangalore_North_Lok_Sabha_constituency] — AC composition for Bangalore North
- [CITED: en.wikipedia.org/wiki/Bangalore_Central_(Lok_Sabha_constituency)] — AC composition for Bangalore Central
- [CITED: en.wikipedia.org/wiki/Bangalore_South_(Lok_Sabha_constituency)] — AC composition for Bangalore South
- [CITED: en.wikipedia.org/wiki/Bangalore_Rural_Lok_Sabha_constituency] — AC composition for Bangalore Rural
- [CITED: bangalore.explocity.com/article/bangalore-city-mlas/] — 2023 Karnataka MLA election results, all 28 GBA constituencies

### Secondary (MEDIUM confidence)
- [CITED: deccanherald.com — "Greater Bengaluru Authority Finalises 10 Zonal Offices"] — 2 zones per corporation, 10 total
- [CITED: businesstoday.in — 2024 Lok Sabha results] — Bangalore North/Central/South/Rural winning MPs

### Tertiary (LOW confidence / ASSUMED)
- A1-A2: Engineering hierarchy alignment of zone/RO/ARO labels — could not verify against current BBMP org chart (SSL expired on site.bbmp.gov.in)
- GBA placeholder org seed structure — temporary per D-12; exact ward office boundaries unconfirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries in use, confirmed from codebase
- Architecture: HIGH — patterns verified directly from codebase
- Migration safety: HIGH — Postgres ALTER TYPE syntax confirmed; no-transaction pragma documented
- Pitfalls: HIGH — all derived from direct code inspection
- MLA names: MEDIUM-HIGH — from 2023 election results via cited source; by-election status unverified
- MP names: MEDIUM-HIGH — from 2024 results; by-election status unverified
- GBA engineering hierarchy: MEDIUM — zone structure confirmed (10 zones); EE/AEE sub-division mapping inferred from geographic structure
- GBA org seed data: LOW — placeholder per D-12; structure unconfirmed

**Research date:** 2026-05-25
**Valid until:** 2026-08-25 (stable stack; MLA/MP names valid until next Karnataka/general election; engineering hierarchy valid until next GBA reorganization)
