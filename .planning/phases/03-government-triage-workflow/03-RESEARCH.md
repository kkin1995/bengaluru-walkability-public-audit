# Phase 3: Government Triage Workflow - Research

**Researched:** 2026-03-14
**Domain:** Rust/Axum backend (status lifecycle, multipart upload, org assignment) + Next.js 14 frontend (admin UI, modal, map pin colors)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Status Enum Migration**
- Rename existing DB values: `submitted → open`, `under_review → acknowledged`, `resolved → resolved` (kept)
- Add new values: `assigned`, `in_progress`, `closed`
- Final enum order: `open → acknowledged → assigned → in_progress → resolved → closed`
- Migration: ALTER TYPE rename approach (not keep-old-plus-add-new) — cleaner, no legacy naming drift
- Any admin (not super-admin only) can perform any status transition including Close
- Free transitions allowed — admins can jump statuses (e.g., Open → Resolved directly); no enforced forward-only constraint

**Org Assignment**
- Assigning a report to an organization automatically advances status to `assigned` — one action, not two
- Assignment UI lives on the report detail view only (`/admin/reports/[id]`) — not inline in the list view
- Org picker uses a hierarchical tree selector (cascading selects: Corporation first, then Ward Office)
- Researcher to seed placeholder GBA org structure based on publicly available GBA 2025 information — this will be replaced when GBA engagement is confirmed

**Resolution Evidence**
- After-photo is mandatory when transitioning to `resolved` — cannot resolve without photo evidence
- After-photo is also mandatory when transitioning to `closed` — prevents skipping Resolved via free transitions with no evidence
- Resolution notes (plain text) are optional at both Resolved and Closed transitions
- Resolve/close action uses a combined modal: one form captures status confirmation + optional notes + mandatory photo upload; single submit commits all
- Resolution notes are admin-only (not public)
- Resolution after-photo is publicly visible on the map popup when present

**Public Map Status Display**
- Pin colors: Red = Open (all pre-resolved statuses: open, acknowledged, assigned, in_progress), Yellow/Amber = In Progress, Green = Resolved/Closed
  - Publicly, three states are meaningful: Open (red), In Progress (yellow), Resolved (green)
- Map popup adds: current status label + after-photo thumbnail when available
- Resolved/closed reports stay on the map indefinitely as green pins — positive evidence of government action

### Claude's Discretion
- Exact Postgres ENUM rename migration syntax (safest approach given live data)
- Admin detail page layout for the new status action buttons and org assignment section
- Exact cascading select component for org hierarchy
- Resolution modal UX details (upload progress, error states)
- Which "in-between" statuses (acknowledged, assigned) show as which color — Red or Amber — on the public map

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WFLOW-01 | Reports support extended status lifecycle: `Open → Acknowledged → Assigned → In Progress → Resolved → Closed` | PostgreSQL ALTER TYPE rename syntax documented; `update_report_status` in `admin_queries.rs` is the extension point; `validate_status` pure function in `admin.rs` must be updated |
| WFLOW-02 | Every status transition recorded in `status_history` with timestamp and acting admin user ID | `status_history` table already has `report_id`, `new_status`, `changed_at`, `note`, `changed_by` columns — no schema changes needed beyond new enum values |
| WFLOW-03 | Admin can assign a report to an organization (corporation or ward office) | `organizations` table exists with `org_type` and `parent_id`; new `assigned_org_id` column on `reports` needed; single-action assign-to-status-assigned pattern confirmed |
| WFLOW-04 | Admin can add resolution notes when closing a report | Notes stored on `status_history.note` (already exists) AND on new `reports.resolution_notes` column for easy retrieval |
| WFLOW-05 | Admin can upload a resolution photo when marking as Resolved | Multipart handler pattern verified in `create_report`; `resolution_photo_path` column on `reports`; same EXIF-strip + path-traversal guard pattern applies |
| MAP-01 | Public map pins color-coded by status (Open=red, In Progress=amber, Resolved=green) | `ReportsMap.tsx` uses `CATEGORY_COLORS` for pin color today; replace with `STATUS_COLORS` lookup; `status` field already in public `ReportResponse` |
| MAP-03 | Report status visible in popup when map pin clicked | `ReportsMap.tsx` popup shows category/severity/description today; add status label and optional resolution photo thumbnail |
</phase_requirements>

---

## Summary

Phase 3 extends an already well-structured Rust/Axum + Next.js 14 codebase. The existing `update_report_status` function and `status_history` table handle the audit trail cleanly — extending the status enum and adding resolution fields is the core backend change. The multipart photo upload pattern from `create_report` is directly reusable for the resolution photo endpoint. On the frontend, the `ReportsMap` component currently colors pins by category; a single `STATUS_COLORS` map replaces `CATEGORY_COLORS` as the color source. The admin detail page at `/admin/reports/[id]` is the single location for all new admin actions (status transitions, org assignment, resolution modal).

The riskiest change is the Postgres ENUM rename migration. PostgreSQL supports `ALTER TYPE ... RENAME VALUE` since version 10 and `ALTER TYPE ... ADD VALUE` since version 9.1, but `ADD VALUE` cannot run inside a transaction block. Since the project uses PostGIS (implying Postgres 12+), the rename syntax is safe. The migration must use the sqlx no-transaction pragma and must update the partial index that references the old `'submitted'` enum value string literal.

The project uses a strict TDD-first skill and granular-commits skill. Every plan wave must write tests before implementation, and the implementation agent must not edit test files.

**Primary recommendation:** Implement in four waves: (1) DB migration + backend enum/model/validation updates, (2) resolution photo upload endpoint, (3) org assignment endpoint + frontend detail page panels, (4) public map pin color and popup updates.

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

## Architecture Patterns

### Recommended Project Structure for Phase 3 Changes

```
backend/
├── migrations/
│   └── 008_workflow.sql          ← ENUM rename + new columns
├── src/
│   ├── handlers/
│   │   └── admin.rs              ← extend validate_status, add resolve_report handler, add assign_org handler
│   ├── db/
│   │   └── admin_queries.rs      ← add resolve_report, assign_report_org, update get_report_stats seed list
│   └── models/
│       └── report.rs             ← add resolution_photo_path, resolution_notes, assigned_org_id fields

frontend/app/
├── admin/
│   ├── components/
│   │   ├── StatusBadge.tsx       ← add 3 new status config entries
│   │   ├── StatusActionPanel.tsx ← NEW: status transition buttons
│   │   ├── OrgAssignPanel.tsx    ← NEW: cascading org selector
│   │   └── ResolveModal.tsx      ← NEW: combined modal (status + notes + photo)
│   ├── reports/[id]/
│   │   └── page.tsx              ← add the three new panels
│   └── lib/
│       └── adminApi.ts           ← add resolveReport (multipart), assignReportOrg functions
└── components/
    └── ReportsMap.tsx            ← replace CATEGORY_COLORS with STATUS_COLORS, add status label + after-photo to popup
```

### Pattern 1: Postgres ENUM Rename + No-Transaction Migration

**What:** Rename existing enum values and add new ones in a single migration file.
**When to use:** When live data uses old enum values that must be preserved through rename.

```sql
-- Source: PostgreSQL 10+ documentation — ALTER TYPE RENAME VALUE
-- File must be annotated: -- no-transaction (sqlx pragma)
-- because ALTER TYPE ADD VALUE cannot run inside a transaction block.

-- Renames (safe without transaction too, but harmless in no-tx context)
ALTER TYPE report_status RENAME VALUE 'submitted' TO 'open';
ALTER TYPE report_status RENAME VALUE 'under_review' TO 'acknowledged';
-- 'resolved' stays as-is

-- Add new values in correct ordinal position
ALTER TYPE report_status ADD VALUE 'assigned'   AFTER 'acknowledged';
ALTER TYPE report_status ADD VALUE 'in_progress' AFTER 'assigned';
ALTER TYPE report_status ADD VALUE 'closed'     AFTER 'resolved';

-- Drop and recreate partial index that referenced old string literal
DROP INDEX IF EXISTS idx_reports_submitted_created;
CREATE INDEX idx_reports_submitted_created ON reports(created_at DESC) WHERE status = 'open';

-- New columns on reports
ALTER TABLE reports
  ADD COLUMN resolution_photo_path TEXT,
  ADD COLUMN resolution_notes      TEXT,
  ADD COLUMN assigned_org_id       UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX idx_reports_assigned_org ON reports(assigned_org_id)
  WHERE assigned_org_id IS NOT NULL;
```

**sqlx no-transaction pragma:** Place `-- no-transaction` as the first non-empty line of `008_workflow.sql`. sqlx 0.7 recognizes this directive and skips wrapping the migration in BEGIN/COMMIT.

### Pattern 2: Resolution Photo Upload via Multipart

**What:** Admin POST endpoint that accepts multipart/form-data with a mandatory photo file plus text fields.
**When to use:** Any endpoint that must combine file upload with structured data.

Key points from the verified `create_report` pattern in `handlers/reports.rs`:
- Use `axum::extract::Multipart` extractor directly in the handler signature
- Collect ALL fields into a local struct with defaults BEFORE any validation (multipart fields are consumed in order — you cannot re-read)
- Field `"resolution_photo"` uses `.bytes().await` same as `"photo"` field
- Apply `strip_exif` before writing to disk
- Generate UUID-based filename: `format!("{}.jpg", Uuid::new_v4())`
- Save to `state.uploads_dir` directory
- Apply path-traversal guard using `std::fs::canonicalize` + `starts_with` check (same as `admin_delete_report`)
- Store only the filename in `resolution_photo_path` column, not the full path
- Validate photo presence AFTER collecting all fields: if `new_status == "resolved" || new_status == "closed"` and `photo_bytes.is_empty()`, return `AppError::BadRequest("Resolution photo is required")`

### Pattern 3: Cascading Org Selector (Frontend, Pure React)

**What:** Two `<select>` elements where the second filters to children of the first selection.
**When to use:** When the `organizations` table has `parent_id` hierarchy of known depth (gba → corporation → ward_office).

The `listOrganizations()` function in `adminApi.ts` already returns `Organization[]` with `id`, `name`, `org_type`, `parent_id`. No new API endpoint needed.

```typescript
// Pure React cascading select pattern
const corporations = orgs.filter(o => o.org_type === 'corporation');
const wardOffices  = selectedCorpId
  ? orgs.filter(o => o.org_type === 'ward_office' && o.parent_id === selectedCorpId)
  : [];
```

The final `assigned_org_id` sent to the backend is the ward_office ID when one is selected, otherwise the corporation ID. This lets GBA assign to the highest-known level in the hierarchy.

### Pattern 4: Status-Based Pin Colors in ReportsMap

**What:** Replace the category-based `CATEGORY_COLORS` lookup with a status-based `STATUS_COLORS` lookup.
**When to use:** Map display post-Phase 3.

```typescript
// Replace CATEGORY_COLORS as the source for CircleMarker fillColor
const STATUS_COLORS: Record<string, string> = {
  open:         "#ef4444", // red
  acknowledged: "#ef4444", // red — pre-action, same visual as open
  assigned:     "#ef4444", // red — assigned but not yet active
  in_progress:  "#f59e0b", // amber
  resolved:     "#22c55e", // green
  closed:       "#22c55e", // green
};
```

The `status` field is already present in public `ReportResponse` (verified in `models/report.rs`). The public `list_reports` endpoint already includes `status` in each item JSON. No API endpoint change is needed for MAP-01.

For MAP-03 (status in popup), the popup in `ReportsMap.tsx` needs a `STATUS_LABELS` map and a line rendering `STATUS_LABELS[report.status]`.

For the resolution after-photo in the popup, `ReportResponse` needs a new optional `resolution_photo_url` field populated from `resolution_photo_path` in `into_response()`. The `Report` interface in `adminApi.ts` also needs updating.

### Anti-Patterns to Avoid

- **JSON body for the resolve endpoint:** The resolution photo requires multipart. Do not use `Json<payload>` — use `Multipart`. Text fields (status, notes) travel as multipart text fields inside the same form.
- **Storing full path in DB:** Store only the filename (`<uuid>.jpg`) in `resolution_photo_path`, not the full absolute path. This matches the existing `image_path` pattern.
- **Running ADD VALUE inside a transaction:** `ALTER TYPE ... ADD VALUE` inside BEGIN/COMMIT causes Postgres error. The sqlx `-- no-transaction` pragma is the solution.
- **Updating the DB without updating validate_status:** The pure function `validate_status` in `admin.rs` hardcodes the old 3 values. It will reject all new status values with 400 until updated.
- **Forgetting get_report_stats seed list:** `admin_queries.rs::get_report_stats` seeds a hard-coded map of status strings. The old keys will show as 0 after rename. Must update to 6-value list.
- **Map legend not updated:** `map/page.tsx` has a hardcoded category-based legend. After pins switch to status colors, the legend must match or it actively misleads users.
- **Content-Type header on FormData fetch:** When sending `FormData` from the browser, do NOT manually set `Content-Type`. The browser sets the correct `multipart/form-data; boundary=...` header automatically. Setting it manually breaks the boundary.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload parsing | Custom multipart parser | Axum's `Multipart` extractor | Already proven in `create_report`; handles chunked uploads and field ordering |
| EXIF stripping | Custom JPEG byte parser | `img-parts` crate (already in Cargo.toml) | Correct JFIF/EXIF handling; already used in `create_report` |
| Path traversal guard | Manual string matching | `std::fs::canonicalize` + `starts_with` | Already used in `admin_delete_report`; proven in this codebase |
| Org tree traversal | Recursive JS tree walk | SQL recursive CTE (pattern already in `count_admin_reports`) | Already implemented for org-scoped report visibility |
| Status audit trail | New audit table | Extend `update_report_status` transaction pattern | `status_history` table already exists with all needed columns |

---

## Common Pitfalls

### Pitfall 1: ALTER TYPE ADD VALUE Cannot Run in a Transaction
**What goes wrong:** sqlx wraps each migration in `BEGIN ... COMMIT` by default. `ALTER TYPE ... ADD VALUE` inside a transaction causes Postgres error: "ALTER TYPE ... ADD VALUE cannot run inside a transaction block".
**Why it happens:** Postgres requires enum value additions to be visible to all connections immediately; wrapping in a transaction prevents this.
**How to avoid:** Add `-- no-transaction` as the first line of `008_workflow.sql`. sqlx 0.7 recognizes this pragma and omits the BEGIN/COMMIT wrapper.
**Warning signs:** `sqlx migrate run` fails on first deploy with the transaction block error message.

### Pitfall 2: Partial Index References Old Enum String Literal
**What goes wrong:** `idx_reports_submitted_created` was created with predicate `WHERE status = 'submitted'`. After renaming `submitted` to `open`, this index may not be used by queries filtering `WHERE status = 'open'` because the stored predicate still references the old label in some Postgres versions.
**Why it happens:** Partial index predicates store the original string literal; Postgres may or may not update it on RENAME depending on version.
**How to avoid:** Explicitly DROP and recreate the partial index in migration 008 using the new value name `'open'`.
**Warning signs:** Query plan shows sequential scan instead of index scan on `status = 'open'` queries.

### Pitfall 3: validate_status Not Updated
**What goes wrong:** After migration, PATCH requests to `/api/admin/reports/:id/status` with `status = "open"` return HTTP 400 "Invalid status" because the pure function still rejects everything except `submitted | under_review | resolved`.
**Why it happens:** The validation function is in a different location from the DB migration and is easy to miss.
**How to avoid:** The test for `validate_status` must be rewritten to cover all 6 new values AND confirm old values are rejected. Tests go in the same wave as the migration.
**Warning signs:** Every status update API call returns 400.

### Pitfall 4: Stats Map Seeding Stale Keys
**What goes wrong:** `get_report_stats` in `admin_queries.rs` seeds a hard-coded list `["submitted", "under_review", "resolved"]`. After migration, all reports have new status values, so those keys show as 0 and the new status values do not appear.
**Why it happens:** The seed list is a local constant that must be kept in sync manually with the enum.
**How to avoid:** Update the seeding array to `["open", "acknowledged", "assigned", "in_progress", "resolved", "closed"]` in the same wave as the migration. A test for stats should assert all 6 keys are present.
**Warning signs:** Admin stats dashboard shows all status counts as 0.

### Pitfall 5: Map Legend Shows Category Colors After Switch to Status Colors
**What goes wrong:** `map/page.tsx` has a hard-coded category legend (red = no footpath, orange = broken, etc). After switching `CircleMarker` fill color to status-based, the legend actively misleads citizens.
**Why it happens:** Legend and map component are in separate files with no shared contract.
**How to avoid:** Update the legend in the same wave as `ReportsMap.tsx` color changes. The legend should show: red = Open issue, amber = In Progress, green = Resolved.
**Warning signs:** The legend colors do not match the pin colors visible on the map.

### Pitfall 6: Resolution Photo URL Missing from Public API
**What goes wrong:** `ReportResponse` (the public struct) has no `resolution_photo_url` field, so the popup in `ReportsMap` cannot display the after-photo even though it is stored.
**Why it happens:** `Report` DB struct and `ReportResponse` are separate; `into_response()` must be updated to compute the URL from `resolution_photo_path`.
**How to avoid:** Add `resolution_photo_url: Option<String>` to `ReportResponse` and populate it in `into_response()`. Populate only when `resolution_photo_path.is_some()`, using the same URL construction pattern as `image_url`.
**Warning signs:** Popup never shows after-photo even for resolved reports.

### Pitfall 7: Multipart Field Order Dependency
**What goes wrong:** Axum's multipart reads fields sequentially — you cannot go back to a previous field. If validation reads `status` first and then tries to read `resolution_photo`, it works. But if `resolution_photo` arrives first in the form and the handler tries to validate `status` before collecting it, the photo bytes are already consumed and gone.
**Why it happens:** HTTP multipart has no guaranteed field order; browser FormData sends in append order.
**How to avoid:** Collect ALL fields into a local struct before any validation. This is exactly how `create_report` works — it builds `CreateReportRequest::default()` and fills it field by field before the validation block.

---

## Code Examples

### Migration 008: Full Schema Change

```sql
-- 008_workflow.sql
-- no-transaction
-- Rationale: ALTER TYPE ADD VALUE cannot run inside a transaction block (Postgres restriction)

-- ── 1. Rename existing enum values ──────────────────────────────────────────
ALTER TYPE report_status RENAME VALUE 'submitted'   TO 'open';
ALTER TYPE report_status RENAME VALUE 'under_review' TO 'acknowledged';
-- 'resolved' unchanged

-- ── 2. Add new enum values in correct ordinal position ──────────────────────
ALTER TYPE report_status ADD VALUE 'assigned'    AFTER 'acknowledged';
ALTER TYPE report_status ADD VALUE 'in_progress' AFTER 'assigned';
ALTER TYPE report_status ADD VALUE 'closed'      AFTER 'resolved';

-- ── 3. Update partial index that referenced old literal ─────────────────────
DROP INDEX IF EXISTS idx_reports_submitted_created;
CREATE INDEX idx_reports_submitted_created ON reports(created_at DESC) WHERE status = 'open';

-- ── 4. New columns on reports ────────────────────────────────────────────────
ALTER TABLE reports
  ADD COLUMN resolution_photo_path TEXT,
  ADD COLUMN resolution_notes      TEXT,
  ADD COLUMN assigned_org_id       UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX idx_reports_assigned_org ON reports(assigned_org_id)
  WHERE assigned_org_id IS NOT NULL;
```

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
// In admin_queries.rs — new function, follows update_report_status transaction pattern
pub async fn resolve_report(
    pool: &PgPool,
    report_id: Uuid,
    new_status: &str,               // "resolved" or "closed"
    resolution_photo_path: &str,
    resolution_notes: Option<&str>,
    changed_by: Uuid,
) -> Result<bool, AppError> {
    let mut tx = pool.begin().await?;

    let result = sqlx::query(
        r#"UPDATE reports
           SET status = $1::report_status,
               resolution_photo_path = $2,
               resolution_notes = $3
           WHERE id = $4"#,
    )
    .bind(new_status)
    .bind(resolution_photo_path)
    .bind(resolution_notes)
    .bind(report_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        tx.rollback().await?;
        return Ok(false);
    }

    sqlx::query(
        "INSERT INTO status_history (report_id, new_status, note, changed_by)
         VALUES ($1, $2::report_status, $3, $4)",
    )
    .bind(report_id)
    .bind(new_status)
    .bind(resolution_notes)
    .bind(changed_by)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(true)
}
```

### Backend: assign_report_org DB Function

```rust
// In admin_queries.rs — single transaction: update assigned_org_id + advance to 'assigned' status
pub async fn assign_report_org(
    pool: &PgPool,
    report_id: Uuid,
    org_id: Uuid,
    changed_by: Uuid,
) -> Result<bool, AppError> {
    let mut tx = pool.begin().await?;

    let result = sqlx::query(
        "UPDATE reports
         SET assigned_org_id = $1, status = 'assigned'::report_status
         WHERE id = $2",
    )
    .bind(org_id)
    .bind(report_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        tx.rollback().await?;
        return Ok(false);
    }

    sqlx::query(
        "INSERT INTO status_history (report_id, new_status, note, changed_by)
         VALUES ($1, 'assigned'::report_status, 'Assigned to organization', $2)",
    )
    .bind(report_id)
    .bind(changed_by)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(true)
}
```

### Frontend: STATUS_COLORS for ReportsMap

```typescript
// In ReportsMap.tsx — replaces CATEGORY_COLORS as the source for CircleMarker fillColor
const STATUS_COLORS: Record<string, string> = {
  open:         "#ef4444", // red
  acknowledged: "#ef4444", // red — pre-action, same visual as open
  assigned:     "#ef4444", // red — assigned but not yet active
  in_progress:  "#f59e0b", // amber
  resolved:     "#22c55e", // green
  closed:       "#22c55e", // green
};

// Usage in CircleMarker:
// fillColor={STATUS_COLORS[report.status] ?? "#ef4444"}
```

### Frontend: resolveReport API function (multipart)

```typescript
// In adminApi.ts — new function for resolution with mandatory photo
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

  // Do NOT set Content-Type manually — browser sets multipart boundary automatically
  const res = await fetch(`${BASE}/api/admin/reports/${id}/resolve`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// New function for org assignment
export async function assignReportOrg(
  reportId: string,
  orgId: string
): Promise<void> {
  return apiFetch<void>(`${BASE}/api/admin/reports/${reportId}/assign-org`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ org_id: orgId }),
  });
}
```

---

## Existing Code: Key Integration Points (Verified from Codebase)

### Backend Changes Required

| File | Current State | Phase 3 Change |
|------|--------------|----------------|
| `migrations/001_init.sql` | `report_status ENUM ('submitted', 'under_review', 'resolved')` | Migration 008 renames + extends |
| `db/admin_queries.rs::update_report_status` | Updates status + inserts status_history row | No change to this function; add new `resolve_report` and `assign_report_org` functions |
| `db/admin_queries.rs::get_report_stats` | Seeds `["submitted", "under_review", "resolved"]` hard-coded keys | Update to 6-value list |
| `db/admin_queries.rs::get_admin_report_by_id` | Selects only pre-Phase-3 columns | Add `resolution_photo_path`, `resolution_notes`, `assigned_org_id` to SELECT |
| `db/admin_queries.rs::list_admin_reports` | Selects only pre-Phase-3 columns | Add new columns to SELECT + JSON mapping |
| `handlers/admin.rs::validate_status` | Accepts only `submitted`, `under_review`, `resolved` | Update match arms to new 6-value set; tests must be rewritten first (TDD) |
| `handlers/admin.rs::admin_update_report_status` | JSON body, no photo | Remains for non-resolution transitions; add new `admin_resolve_report` handler (multipart) and `admin_assign_report_org` handler (JSON) |
| `models/report.rs::Report` | No resolution or org fields | Add `resolution_photo_path: Option<String>`, `resolution_notes: Option<String>`, `assigned_org_id: Option<Uuid>` |
| `models/report.rs::ReportResponse` | No resolution fields | Add `resolution_photo_url: Option<String>`, populate in `into_response()` |

### Frontend Changes Required

| File | Current State | Phase 3 Change |
|------|--------------|----------------|
| `admin/components/StatusBadge.tsx` | 3 status configs (submitted, under_review, resolved) | Add 4 new configs: open, acknowledged, assigned, in_progress, closed (update existing submitted/under_review to new names) |
| `admin/reports/[id]/page.tsx` | Shows report details only | Add `StatusActionPanel`, `OrgAssignPanel`, `ResolveModal` components |
| `admin/lib/adminApi.ts::AdminReport` interface | No resolution or org fields | Add `resolution_photo_url`, `resolution_notes`, `assigned_org_id` fields |
| `admin/lib/adminApi.ts` functions | `updateReportStatus` (JSON) | Add `resolveReport` (multipart), `assignReportOrg` (JSON) functions |
| `components/ReportsMap.tsx` | `CATEGORY_COLORS` drives pin color | Replace with `STATUS_COLORS`; add status label to popup; add optional after-photo thumbnail |
| `map/page.tsx` | Category-based legend | Update to status-based legend (red=Open, amber=In Progress, green=Resolved) |

### New Axum Routes to Register

```
POST /api/admin/reports/:id/resolve     ← multipart handler for resolved/closed with mandatory photo
POST /api/admin/reports/:id/assign-org  ← JSON handler for org assignment (auto-advances to assigned)
```

The existing `PATCH /api/admin/reports/:id/status` remains for simpler transitions (open, acknowledged, in_progress) that do not require a photo.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| 3-value status enum (submitted/under_review/resolved) | 6-value enum (open/acknowledged/assigned/in_progress/resolved/closed) | Richer triage workflow for GBA |
| Category-colored map pins | Status-colored map pins | Citizens see resolution progress, not just issue type |
| No resolution evidence | Mandatory after-photo on resolved/closed | Accountability: cannot close without photographic proof |
| Status transitions via JSON PATCH | Resolve/close via multipart POST | Supports file upload alongside text fields in one request |

---

## Open Questions

1. **Resolution notes: `status_history.note` vs `reports.resolution_notes`**
   - What we know: `status_history.note` already exists; `reports.resolution_notes` is a new column
   - What's unclear: Storing on the report itself simplifies the admin detail view fetch (no JOIN)
   - Recommendation: Write to both — `reports.resolution_notes` for easy retrieval in the detail view, `status_history.note` for audit trail completeness. Migration adds the column; `resolve_report` function writes to both.

2. **sqlx no-transaction migration split vs single file**
   - What we know: sqlx 0.7 supports `-- no-transaction` at top of file
   - What's unclear: Whether to split into `008a` (RENAME, in-tx) and `008b` (ADD VALUE, no-tx)
   - Recommendation: Single `008_workflow.sql` with `-- no-transaction`. All statements in the file are safe without a transaction wrapper (RENAME is idempotent, column additions are DDL). Simpler to review and roll back as a unit.

3. **GBA org seed data for placeholder**
   - What we know: `organizations` table is empty; STATE.md notes GBA org structure unconfirmed
   - Recommendation: Seed one BBMP corporation entry and 2-3 ward office placeholders clearly marked with SQL comments as `-- PLACEHOLDER: replace when GBA structure confirmed`. This gives the cascading selector real data to test against without blocking development.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (Frontend) | Jest 29.7.0 + @testing-library/react 14.3.1 |
| Framework (Backend) | Rust built-in (`cargo test`) |
| Config file (Frontend) | `frontend/jest.config.js` (inferred from package.json `"test": "jest"`) |
| Quick run (Frontend) | `cd frontend && npm test -- --passWithNoTests` |
| Full suite (Frontend) | `cd frontend && npm test` |
| Quick run (Backend) | `cd backend && cargo test` |
| Full suite (Backend) | `cd backend && cargo test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WFLOW-01 | `validate_status` accepts all 6 new values | unit (backend) | `cd backend && cargo test test_validate_status` | ❌ Wave 0 — tests must be rewritten |
| WFLOW-01 | `validate_status` rejects old 3 names (`submitted`, `under_review`) | unit (backend) | `cd backend && cargo test test_validate_status` | ❌ Wave 0 |
| WFLOW-02 | Status history row inserted on each transition | integration (DB required) | manual via docker-compose | Covered by existing `update_report_status` pattern |
| WFLOW-03 | `assignReportOrg` API function sends correct payload | unit (frontend) | `cd frontend && npm test -- --testPathPattern=adminApi` | ❌ Wave 0 |
| WFLOW-03 | OrgAssignPanel renders corporation dropdown | unit (frontend) | `cd frontend && npm test -- --testPathPattern=OrgAssignPanel` | ❌ Wave 0 |
| WFLOW-03 | OrgAssignPanel filters ward offices by selected corporation | unit (frontend) | `cd frontend && npm test -- --testPathPattern=OrgAssignPanel` | ❌ Wave 0 |
| WFLOW-04 | ResolveModal renders notes textarea (optional) | unit (frontend) | `cd frontend && npm test -- --testPathPattern=ResolveModal` | ❌ Wave 0 |
| WFLOW-05 | ResolveModal requires photo before submit; submit disabled without photo | unit (frontend) | `cd frontend && npm test -- --testPathPattern=ResolveModal` | ❌ Wave 0 |
| WFLOW-05 | Pure validation: missing photo for resolved/closed returns BadRequest | unit (backend) | `cd backend && cargo test test_validate_resolve` | ❌ Wave 0 |
| MAP-01 | ReportsMap CircleMarker uses `STATUS_COLORS[report.status]` not category color | unit (frontend) | `cd frontend && npm test -- --testPathPattern=ReportsMap` | ❌ Wave 0 |
| MAP-03 | Popup renders status label text | unit (frontend) | `cd frontend && npm test -- --testPathPattern=ReportsMap` | ❌ Wave 0 |
| MAP-03 | Popup renders after-photo `<img>` when `resolution_photo_url` present | unit (frontend) | `cd frontend && npm test -- --testPathPattern=ReportsMap` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && cargo test` + `cd frontend && npm test -- --passWithNoTests`
- **Per wave merge:** Full suite both sides
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/handlers/admin.rs` — `validate_status` test module must be updated: rewrite tests to cover 6 new values and reject renamed values
- [ ] `frontend/app/admin/components/__tests__/ResolveModal.test.tsx` — new file: photo requirement enforcement, notes textarea, submit button state
- [ ] `frontend/app/admin/components/__tests__/OrgAssignPanel.test.tsx` — new file: corporation dropdown renders, ward offices filter by selected corp
- [ ] `frontend/app/admin/components/__tests__/StatusActionPanel.test.tsx` — new file: status transition buttons render for correct states
- [ ] `frontend/app/components/__tests__/ReportsMap.test.tsx` — existing file: add tests for STATUS_COLORS usage and popup status label rendering
- [ ] `frontend/app/admin/reports/[id]/__tests__/page.test.tsx` — existing file: add tests for new panels appearing in detail view

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `backend/src/db/admin_queries.rs` — `update_report_status`, `list_admin_reports`, `get_admin_report_by_id`, `get_report_stats`
- Direct codebase inspection: `backend/src/handlers/admin.rs` — `validate_status`, `admin_update_report_status`, multipart pattern context
- Direct codebase inspection: `backend/src/handlers/reports.rs` — `create_report` multipart pattern (full verified pattern for photo upload)
- Direct codebase inspection: `backend/migrations/001_init.sql` through `007_anti_abuse.sql` — current schema state
- Direct codebase inspection: `frontend/app/components/ReportsMap.tsx` — current pin color pattern
- Direct codebase inspection: `frontend/app/admin/lib/adminApi.ts` — existing API client patterns
- Direct codebase inspection: `frontend/app/admin/reports/[id]/page.tsx` and `StatusBadge.tsx`
- Direct codebase inspection: `backend/src/models/report.rs` — `Report`, `ReportResponse`, `into_response()`
- `.planning/phases/03-government-triage-workflow/03-CONTEXT.md` — locked user decisions

### Secondary (MEDIUM confidence)
- PostgreSQL ALTER TYPE RENAME VALUE — syntax confirmed for Postgres 10+; project uses PostGIS which requires Postgres 12+
- sqlx 0.7 `-- no-transaction` migration pragma — documented in sqlx migration guide

### Tertiary (LOW confidence)
- GBA/BBMP corporation + ward office structure for seed data — based on publicly available BBMP information, unverified as current for 2025

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, confirmed from Cargo.toml and package.json
- Architecture: HIGH — patterns verified directly from existing codebase files
- Migration safety: HIGH — Postgres ALTER TYPE syntax confirmed; no-transaction pragma documented
- Pitfalls: HIGH — derived entirely from direct code inspection (partial index literal, validate_status, stats seed, map legend, multipart field order)
- GBA org seed data: LOW — public data, unverified for current 2025 structure

**Research date:** 2026-03-14
**Valid until:** 2026-06-14 (stable stack; sqlx 0.7 and axum 0.7 APIs are stable)
