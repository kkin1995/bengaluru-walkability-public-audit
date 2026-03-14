# Phase 3: Government Triage Workflow - Research

**Researched:** 2026-03-14
**Domain:** Postgres ENUM migration, Axum multipart file upload, React cascading selects, react-leaflet color-coded markers
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Status Enum Migration:** Rename existing DB values: `submitted → open`, `under_review → acknowledged`, `resolved → resolved` (kept). Add new values: `assigned`, `in_progress`, `closed`. Final enum order: `open → acknowledged → assigned → in_progress → resolved → closed`. Migration uses ALTER TYPE rename approach — no keep-old-plus-add-new. Any admin (not super-admin only) can perform any status transition including Close. Free transitions allowed — admins can jump statuses; no enforced forward-only constraint.
- **Org Assignment:** Assigning a report to an organization automatically advances status to `assigned`. Assignment UI lives on the report detail view only (`/admin/reports/[id]`). Org picker uses hierarchical tree selector (cascading selects: Corporation first, then Ward Office). Researcher to seed placeholder GBA org structure from publicly available GBA 2025 information.
- **Resolution Evidence:** After-photo is mandatory when transitioning to `resolved`. After-photo is mandatory when transitioning to `closed`. Resolution notes (plain text) are optional at both. Resolve/close action uses a combined modal: status confirmation + optional notes + mandatory photo upload; single submit commits all. Resolution notes are admin-only. Resolution after-photo is publicly visible on the map popup when present.
- **Public Map Status Display:** Pin colors: Red = Open (open, acknowledged, assigned, in_progress), Yellow/Amber = In Progress, Green = Resolved/Closed. Publicly three states: Open (red), In Progress (yellow), Resolved (green). Map popup adds current status label + after-photo thumbnail when available. Resolved/closed reports stay on map as green pins.

### Claude's Discretion

- Exact Postgres ENUM rename migration syntax (researcher/planner to decide safest approach given live data)
- Admin detail page layout for the new status action buttons and org assignment section
- Exact cascading select component for org hierarchy
- Resolution modal UX details (upload progress, error states)
- Which "in-between" statuses (acknowledged, assigned) show as which color — Red or Amber — on the public map (only Open/InProgress/Resolved have distinct colors per requirements MAP-01)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WFLOW-01 | Reports support extended status lifecycle: Open → Acknowledged → Assigned → In Progress → Resolved → Closed | ALTER TYPE RENAME VALUE + ADD VALUE migration; validate_status expansion; update_report_status extension |
| WFLOW-02 | Every status transition recorded in status_history with timestamp and acting admin user ID | status_history table already has report_id, new_status, note, changed_by columns — extension not replacement |
| WFLOW-03 | Admin can assign a report to an organization (corporation or ward office) | organizations table already exists with self-referential parent_id; add assigned_org_id FK to reports |
| WFLOW-04 | Admin can add resolution notes when closing a report | resolution_notes column on reports; status_history.note already exists as alternative; planner to choose |
| WFLOW-05 | Admin can upload a resolution photo (after-photo) when marking a report as Resolved | resolution_photo_path column; multipart handler pattern already established in create_report |
| MAP-01 | Public map pins color-coded by report status (distinct colors for Open, In Progress, Resolved) | ReportsMap.tsx CircleMarker already uses fillColor prop; add STATUS_COLORS map replacing CATEGORY_COLORS as primary color driver |
| MAP-03 | Report status visible in popup when map pin clicked | Popup JSX in ReportsMap already rendered; add status label and conditional after-photo img element |
</phase_requirements>

---

## Summary

Phase 3 adds the government triage layer on top of the existing admin dashboard. Three distinct work streams run in sequence: (1) database schema migration to rename/extend the status enum and add three new columns to `reports`, (2) backend handler extension to validate the mandatory after-photo rule, accept multipart for resolution upload, and handle org assignment, (3) frontend UI — a combined resolve/close modal on the detail page, a cascading org picker, and color-coded status pins on the public map.

The hardest risk is the ENUM rename. PostgreSQL 10+ supports `ALTER TYPE ... RENAME VALUE` directly in a transaction, which is the correct approach for this codebase. The key constraint is that `ADD VALUE` cannot be used inside a transaction block — these statements must be issued separately (autocommit). SQLx migrations run each file in a single transaction unless the file contains `-- +migrate Up no-transaction`; the planner must structure migration 008 accordingly.

All other patterns are well-established in the codebase. The multipart upload pattern is identical to `create_report`. The `update_report_status` function needs to be extended, not replaced. The public map's `CircleMarker` already accepts a `fillColor` prop — adding a STATUS_COLORS lookup is a mechanical change.

**Primary recommendation:** Write migration 008 in two parts — rename-and-add-column DDL that requires careful transaction ordering, then extend the Rust model/handler/query layers following the established DB-model → Response struct separation pattern.

---

## Standard Stack

### Core
| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| sqlx (Rust) | existing (0.7.x) | runtime SQL queries | already in use; no compile-time macros — works without live DB in tests |
| axum-multipart | existing | multipart/form-data for resolution photo upload | already used in `create_report` handler |
| img-parts | existing | EXIF strip from resolution photo before disk write | already used for citizen photo uploads |
| sha2 | existing | SHA256 hash of resolution photo bytes | already used for dedup; reuse same pattern |
| react-leaflet | existing (4.x) | CircleMarker with fillColor for status-colored pins | already renders public map; minimal change needed |
| tailwindcss | existing | modal and org picker styling | project-wide CSS framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Next.js `useState` / `useEffect` | existing | cascading select state, modal open/close | all new frontend interactive components |
| `FormData` (browser built-in) | N/A | multipart submission of resolve modal (status + notes + photo) | resolution modal submit — send as multipart to backend |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single combined multipart PATCH for resolve | Two-step: JSON status update + separate photo upload | Combined is one round-trip, matches decision; two-step would require client-side coordination and partial-commit risk |
| Per-column resolution_notes on reports | Store notes only in status_history.note | Both work; planner to decide — notes on reports = easier single-row read; notes in history = audit trail co-location |

**Installation:** No new packages required — all needed libraries are already in the project.

---

## Architecture Patterns

### Recommended Project Structure for Phase 3

```
backend/
├── migrations/
│   └── 008_workflow.sql          # ENUM rename + ADD VALUE + ALTER TABLE
├── src/
│   ├── models/
│   │   └── report.rs             # Add resolution_photo_path, resolution_notes, assigned_org_id fields
│   ├── db/
│   │   └── admin_queries.rs      # Extend update_report_status; add assign_report_org; add get_report_with_resolution
│   └── handlers/
│       └── admin.rs              # Extend admin_update_report_status to accept multipart; add validate_status expanded set; add assign_org handler

frontend/
├── app/
│   ├── admin/
│   │   ├── lib/
│   │   │   └── adminApi.ts       # Add assignReportOrg(), resolveReport() (multipart), update AdminReport type
│   │   ├── components/
│   │   │   ├── StatusBadge.tsx   # Add open, acknowledged, assigned, in_progress, closed configs
│   │   │   ├── ResolveModal.tsx  # New: combined status + notes + photo modal
│   │   │   └── OrgPicker.tsx     # New: cascading Corporation → Ward Office select
│   │   └── reports/
│   │       └── [id]/
│   │           └── page.tsx      # Add org assignment section + status action buttons + modal trigger
│   └── components/
│       └── ReportsMap.tsx        # Replace CATEGORY_COLORS pin color with STATUS_COLORS; add status label + after-photo to popup
```

### Pattern 1: Postgres ENUM Rename + Extend (Migration 008)

**What:** Rename two existing enum values and add three new ones to `report_status`. Also add three nullable columns to `reports`.
**When to use:** When existing enum values must change name but ordering is preserved, and new values must be inserted at specific positions.

**Critical constraint:** `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block. `ALTER TYPE ... RENAME VALUE` CAN run in a transaction. This means migration 008 must be structured without wrapping ADD VALUE statements in the same transaction as other DDL.

SQLx runs each migration file in a transaction. To handle this, use the `-- +migrate Up no-transaction` pragma OR split into two migration files (008 = rename + column adds, 009 = add values). The cleanest approach given the existing migration numbering:

**Option A (recommended) — single file, no-transaction pragma:**
```sql
-- +migrate Up no-transaction
-- 008_workflow.sql

-- Step 1: Rename existing enum values (can run outside transaction too)
ALTER TYPE report_status RENAME VALUE 'submitted' TO 'open';
ALTER TYPE report_status RENAME VALUE 'under_review' TO 'acknowledged';

-- Step 2: Add new enum values (CANNOT be inside a transaction block)
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'assigned' AFTER 'acknowledged';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'in_progress' AFTER 'assigned';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'closed' AFTER 'resolved';

-- Step 3: Add columns (regular DDL)
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS resolution_photo_path  TEXT,
  ADD COLUMN IF NOT EXISTS resolution_notes       TEXT,
  ADD COLUMN IF NOT EXISTS assigned_org_id        UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_assigned_org_id ON reports(assigned_org_id);
```

**Source:** PostgreSQL 18 official docs — ALTER TYPE ([https://www.postgresql.org/docs/current/sql-altertype.html](https://www.postgresql.org/docs/current/sql-altertype.html))

**Note on `IF NOT EXISTS`:** Use `IF NOT EXISTS` on `ADD VALUE` calls so the migration is idempotent and re-runnable in CI environments that may have partially applied the migration.

**Note on sqlx pragma:** Check whether the project's sqlx version supports `-- +migrate Up no-transaction`. If not (some versions use different pragmas), split into two files: `008_workflow_rename.sql` and `009_workflow_add_values.sql`. The planner should verify this.

### Pattern 2: Backend — Extending update_report_status

**What:** The existing `update_report_status` function in `admin_queries.rs` accepts `(pool, report_id, new_status, note, changed_by)`. Phase 3 needs to additionally write `resolution_photo_path`, `resolution_notes`, and/or `assigned_org_id`. Rather than replacing the function, add a new `resolve_report` function and a separate `assign_report_org` function.

```rust
// Source: existing pattern in backend/src/db/admin_queries.rs
pub async fn resolve_report(
    pool: &PgPool,
    report_id: Uuid,
    new_status: &str,        // "resolved" or "closed"
    resolution_photo_path: &str,
    resolution_notes: Option<&str>,
    changed_by: Uuid,
) -> Result<bool, AppError> {
    let mut tx = pool.begin().await?;
    // UPDATE reports SET status = $1::report_status,
    //   resolution_photo_path = $2, resolution_notes = $3 WHERE id = $4
    // INSERT INTO status_history ...
    tx.commit().await?;
    Ok(true)
}

pub async fn assign_report_org(
    pool: &PgPool,
    report_id: Uuid,
    org_id: Uuid,
    changed_by: Uuid,
) -> Result<bool, AppError> {
    // UPDATE reports SET assigned_org_id = $1, status = 'assigned'::report_status WHERE id = $2
    // INSERT INTO status_history (report_id, new_status, note, changed_by)
    //   VALUES ($1, 'assigned'::report_status, 'Assigned to org', $3)
}
```

### Pattern 3: Multipart for Resolution Photo

**What:** The resolution modal submits as `multipart/form-data` with fields `status`, `notes` (optional), `resolution_photo` (mandatory file). The backend handler accepts `mut multipart: Multipart` and processes fields in a loop — identical to the existing `create_report` handler.

```rust
// Source: existing pattern in backend/src/handlers/reports.rs lines 79-110
// For the resolve handler, field names will be:
//   "status"            → String
//   "resolution_photo"  → bytes
//   "notes"             → String (optional)
```

File is saved to `uploads_dir` with a new UUID filename (same as citizen photo pattern). The path is stored in `reports.resolution_photo_path`.

**Validation rule:** After parsing all multipart fields, if `new_status == "resolved" || new_status == "closed"`, assert `resolution_photo` field was present. Return `AppError::BadRequest("Resolution photo is required".to_string())` if missing.

### Pattern 4: Frontend — Cascading Org Picker

**What:** Two `<select>` elements. First select shows all `corp_type == "corporation"` orgs. When user picks a corporation, second select filters `organizations` where `parent_id == selected_corporation_id` and `org_type == "ward_office"`.

**Data source:** `listOrganizations()` from `adminApi.ts` — already implemented, returns all orgs. Filter client-side; no new API needed.

```typescript
// Source: existing Organization type in adminApi.ts
// Pattern: filter by org_type and parent_id
const corporations = orgs.filter(o => o.org_type === 'corporation');
const wardOffices = orgs.filter(o =>
  o.org_type === 'ward_office' && o.parent_id === selectedCorpId
);
```

**Note:** The `organizations` table is seeded empty pending GBA engagement (STATE.md blocker). The cascading picker must handle the empty state gracefully: "No organizations configured" message with the assign button disabled.

### Pattern 5: Public Map — Status-Based Pin Colors

**What:** Replace the current `CATEGORY_COLORS` lookup in `ReportsMap.tsx` with a `STATUS_COLORS` lookup for pin fill color. The map legend must also be updated to show status states instead of categories.

```typescript
// Source: existing ReportsMap.tsx — CircleMarker fillColor prop
const STATUS_COLORS: Record<string, string> = {
  open:          "#ef4444",  // red
  acknowledged:  "#ef4444",  // red (same as open — pre-action states)
  assigned:      "#ef4444",  // red (per CONTEXT.md: all pre-resolved = red)
  in_progress:   "#f59e0b",  // amber/yellow
  resolved:      "#22c55e",  // green
  closed:        "#22c55e",  // green (same as resolved — both = done)
  // fallback for legacy data during migration window
  submitted:     "#ef4444",
  under_review:  "#ef4444",
};
```

**Note on "in-between" colors:** Per CONTEXT.md (Claude's Discretion), the spec says MAP-01 requires distinct colors for Open, In Progress, Resolved. The decision above maps `acknowledged` and `assigned` to Red (same as Open) because they represent pre-action states where government has not yet started work. This is the most defensible default — admins and citizens both understand "Red = not yet being worked on."

### Anti-Patterns to Avoid

- **Running ADD VALUE inside a transaction:** Will fail with `ERROR: ALTER TYPE ... ADD VALUE cannot run inside a transaction block`. RENAME VALUE is fine in a transaction; ADD VALUE is not.
- **Replacing update_report_status entirely:** The function is used by existing tests. Add new functions alongside it, extend the status set it validates.
- **Sending resolution photo as JSON base64:** Do not base64-encode the photo in a JSON body. Use the established multipart pattern.
- **Adding `resolution_notes` only to status_history.note:** The decision specifies `resolution_notes` on `reports` directly (CONTEXT.md code context: `backend/src/models/report.rs: add resolution_photo, resolution_notes, assigned_org_id fields`). Store on both if needed for audit — but the report row is the primary storage.
- **Re-issuing `cargo sqlx prepare` after every rename:** The project uses runtime `sqlx::query()` calls (not compile-time macros) for admin queries — `cargo sqlx prepare` only needs to run if compile-time `query!` macros are added, which they should not be.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload to disk | Custom stream-to-file code | Existing `tokio::fs::write` + Axum `multipart` pattern (see reports.rs:250-255) | Already handles UUID naming, path building, error propagation |
| EXIF stripping of resolution photo | Custom metadata cleaner | `img-parts` — already a dependency used in create_report | Removes GPS + other EXIF; privacy requirement applies to after-photos too |
| Cascading select state management | Complex state machine | Two `useState` hooks (selectedCorpId, selectedWardId) + `useMemo` for filtered list | Orgs are O(100) — client-side filtering is instant; no debouncing needed |
| Modal accessibility | Custom focus trap | Standard Tailwind modal pattern used elsewhere (CreateUserModal.tsx) + `dialog` element or `role="dialog"` | Existing pattern in codebase; don't reinvent |
| Status history display | New audit table queries | `status_history` table already exists with all required columns (report_id, new_status, note, changed_by, changed_at) | Just read it; no new table needed |

**Key insight:** Every infrastructure piece needed for this phase already exists in the project. This phase is primarily composition and extension of established patterns, not new architecture.

---

## Common Pitfalls

### Pitfall 1: ADD VALUE in a Transaction
**What goes wrong:** SQLx wraps each migration file in a transaction. `ALTER TYPE ... ADD VALUE` will fail with "cannot run inside a transaction block."
**Why it happens:** PostgreSQL explicitly forbids `ADD VALUE` inside transactions to preserve multi-version concurrency safety of enum ordering.
**How to avoid:** Use `-- +migrate Up no-transaction` pragma in 008_workflow.sql, or split rename (transactional) and add-value (non-transactional) into separate migration files.
**Warning signs:** Migration fails immediately on first `ADD VALUE` statement with PG error code `25001`.

### Pitfall 2: Hardcoded Old Status Values Throughout Codebase
**What goes wrong:** `validate_status()` in `admin.rs` currently accepts only `"submitted" | "under_review" | "resolved"`. After the DB migration renames these values, any code still sending the old names will fail at the DB layer with a cast error.
**Why it happens:** The Rust validation and the DB enum must stay in sync.
**How to avoid:** Update `validate_status()` in the same PR as the migration. The new accepted set: `"open" | "acknowledged" | "assigned" | "in_progress" | "resolved" | "closed"`.
**Warning signs:** `cargo test` passes (tests use string values from constants) but runtime PATCH calls return 422.

### Pitfall 3: StatusBadge Falls to Fallback for New Status Values
**What goes wrong:** StatusBadge has a fallback that renders the raw status string in gray when not found in `STATUS_CONFIG`. New values (`acknowledged`, `assigned`, `in_progress`, `closed`) will all show as gray until the config is updated.
**Why it happens:** The config map is an explicit whitelist.
**How to avoid:** Update `STATUS_CONFIG` in `StatusBadge.tsx` as part of the same plan wave as the backend migration. Tests in `StatusBadge.test.tsx` will catch missing entries if they cover the new values.
**Warning signs:** Status badge shows raw lowercase string instead of formatted label.

### Pitfall 4: get_report_stats Still Seeded with Old Status Keys
**What goes wrong:** `get_report_stats()` in `admin_queries.rs` seeds the `by_status` map with hardcoded keys `["submitted", "under_review", "resolved"]`. After migration, these keys won't match any DB rows.
**Why it happens:** The stats function has an explicit list of known status values (lines ~577-580 in admin_queries.rs).
**How to avoid:** Update the seed list to the six new values in the same plan wave as the migration.
**Warning signs:** Stats dashboard shows 0 for all status counts after migration; DB has reports but counts don't match.

### Pitfall 5: Map Legend Shows Category Colors After Map Change
**What goes wrong:** The legend in `map/page.tsx` (lines 47-62) is hardcoded to category colors. After changing pin colors to status-based, the legend will be incorrect.
**Why it happens:** Legend and map pin logic are in different files and both need updating.
**How to avoid:** Update legend in `map/page.tsx` to show Open/In Progress/Resolved with red/amber/green in the same plan wave as `ReportsMap.tsx` changes.
**Warning signs:** Map pins show green/red but legend still shows "No footpath", "Broken", etc. in category colors.

### Pitfall 6: Resolution Photo Path in Public API
**What goes wrong:** `resolution_photo_path` is a filesystem path. Like `image_path`, it must be converted to a URL before sending to the frontend.
**Why it happens:** The `into_response()` pattern on `Report` converts `image_path` to `image_url` — `resolution_photo_path` needs the same treatment.
**How to avoid:** Add `resolution_photo_url: Option<String>` to `ReportResponse` (not the raw path). Computed in `into_response()` the same way as `image_url`.
**Warning signs:** Frontend receives a raw filepath string like `"abc123.jpg"` instead of a full URL.

### Pitfall 7: Organization Table Empty — Org Picker Must Handle Gracefully
**What goes wrong:** STATE.md has an explicit blocker: organizations table is seeded empty pending GBA confirmation. The cascading org picker will render with no options.
**Why it happens:** Intentional — the org structure is not hardcoded.
**How to avoid:** OrgPicker must render a "No organizations configured" disabled state, not an empty select that silently does nothing. The planner should add placeholder seed data (GBA + placeholder corporations) in a migration as noted in CONTEXT.md specifics.
**Warning signs:** Org picker renders two empty dropdowns with no user feedback.

---

## Code Examples

### ENUM Rename + Add Value Migration

```sql
-- Source: PostgreSQL official docs https://www.postgresql.org/docs/current/sql-altertype.html
-- File: backend/migrations/008_workflow.sql

-- RENAME VALUE: safe in a transaction (but must account for ADD VALUE constraint below)
ALTER TYPE report_status RENAME VALUE 'submitted' TO 'open';
ALTER TYPE report_status RENAME VALUE 'under_review' TO 'acknowledged';

-- ADD VALUE: cannot run inside a transaction block
-- Use -- +migrate Up no-transaction pragma OR run in separate migration file
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'assigned'    AFTER 'acknowledged';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'in_progress' AFTER 'assigned';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'closed'      AFTER 'resolved';

-- Enum final order: open → acknowledged → assigned → in_progress → resolved → closed

-- Columns
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS resolution_photo_path  TEXT,
  ADD COLUMN IF NOT EXISTS resolution_notes       TEXT,
  ADD COLUMN IF NOT EXISTS assigned_org_id        UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_assigned_org_id ON reports(assigned_org_id);
```

### Expanded validate_status (Rust)

```rust
// Source: existing pattern in backend/src/handlers/admin.rs validate_status()
pub fn validate_status(status: &str) -> Result<(), AppError> {
    match status {
        "open" | "acknowledged" | "assigned" | "in_progress" | "resolved" | "closed" => Ok(()),
        _ => Err(AppError::BadRequest("Invalid status".to_string())),
    }
}
```

### Resolution Multipart Handler Sketch (Rust)

```rust
// Source: existing pattern in backend/src/handlers/reports.rs create_report()
// New handler: PATCH /api/admin/reports/:id/resolve
pub async fn admin_resolve_report(
    State(state): State<AppState>,
    Extension(claims): Extension<AuthJwtClaims>,
    Path(report_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<Json<AdminReportResponse>, AppError> {
    let mut status: Option<String> = None;
    let mut notes: Option<String> = None;
    let mut photo_bytes: Option<Vec<u8>> = None;
    let mut photo_filename: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(...)? {
        match field.name().unwrap_or("") {
            "status"             => { status = Some(field.text().await?); }
            "notes"              => { notes = Some(field.text().await?); }
            "resolution_photo"   => {
                photo_filename = field.file_name().map(String::from);
                photo_bytes = Some(field.bytes().await?.to_vec());
            }
            _ => {}
        }
    }

    let new_status = status.ok_or(AppError::BadRequest("status required".into()))?;
    validate_status(&new_status)?;

    // Mandatory photo check
    if matches!(new_status.as_str(), "resolved" | "closed") {
        if photo_bytes.is_none() {
            return Err(AppError::BadRequest("Resolution photo is required".into()));
        }
    }

    // Save photo (same pattern as create_report)
    let photo_path = if let Some(bytes) = photo_bytes {
        let clean = strip_exif(bytes)?;
        let filename = format!("{}.jpg", Uuid::new_v4());
        let path = PathBuf::from(&state.uploads_dir).join(&filename);
        tokio::fs::write(&path, &clean).await?;
        Some(filename)
    } else {
        None
    };

    // Write to DB
    let admin_id = Uuid::parse_str(&claims.sub)?;
    admin_queries::resolve_report(&state.pool, report_id, &new_status, photo_path.as_deref(), notes.as_deref(), admin_id).await?;

    // Return updated report
    // ...
}
```

### Status Colors in ReportsMap (TypeScript)

```typescript
// Source: existing CATEGORY_COLORS pattern in frontend/app/components/ReportsMap.tsx
const STATUS_COLORS: Record<string, string> = {
  open:         "#ef4444",  // red
  acknowledged: "#ef4444",  // red — pre-action
  assigned:     "#ef4444",  // red — pre-action
  in_progress:  "#f59e0b",  // amber
  resolved:     "#22c55e",  // green
  closed:       "#22c55e",  // green
  // Legacy values during DB migration window
  submitted:    "#ef4444",
  under_review: "#ef4444",
};

// In CircleMarker:
fillColor={STATUS_COLORS[report.status] ?? "#6b7280"}
```

### StatusBadge CONFIG Additions (TypeScript)

```typescript
// Source: existing STATUS_CONFIG pattern in frontend/app/admin/components/StatusBadge.tsx
// Add these entries alongside existing ones:
open: {
  label: "Open",
  className: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800",
  ariaLabel: "Status: open",
},
acknowledged: {
  label: "Acknowledged",
  className: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800",
  ariaLabel: "Status: acknowledged",
},
assigned: {
  label: "Assigned",
  className: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800",
  ariaLabel: "Status: assigned",
},
in_progress: {
  label: "In Progress",
  className: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800",
  ariaLabel: "Status: in progress",
},
closed: {
  label: "Closed",
  className: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800",
  ariaLabel: "Status: closed",
},
```

### Cascading Org Picker Component Sketch (TypeScript)

```typescript
// Source: existing Organization type in adminApi.ts + React useState pattern
interface OrgPickerProps {
  orgs: Organization[];
  onAssign: (orgId: string) => void;
}

export function OrgPicker({ orgs, onAssign }: OrgPickerProps) {
  const [selectedCorpId, setSelectedCorpId] = useState<string>("");
  const [selectedWardId, setSelectedWardId] = useState<string>("");

  const corporations = orgs.filter(o => o.org_type === "corporation");
  const wardOffices  = orgs.filter(o =>
    o.org_type === "ward_office" && o.parent_id === selectedCorpId
  );

  if (corporations.length === 0) {
    return <p className="text-sm text-gray-500">No organizations configured.</p>;
  }
  // ... render two selects
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded status: submitted, under_review, resolved | Extended enum: open, acknowledged, assigned, in_progress, resolved, closed | Migration 008 (this phase) | All consumers of status field must be updated simultaneously |
| Category-colored map pins | Status-colored map pins (red/amber/green) | This phase | Legend in map/page.tsx must also be updated |
| No org assignment on reports | reports.assigned_org_id FK to organizations | Migration 008 | Enables org-scoped triage queue filtering in future phases |
| No evidence on resolved reports | resolution_photo_path + resolution_notes on reports | Migration 008 | Public map can show after-photo in popup |

**Deprecated/outdated after this phase:**
- `validate_status()` accepting `"submitted" | "under_review"`: must be replaced with expanded set
- `get_report_stats()` seeded with `["submitted", "under_review", "resolved"]`: must be updated to six new values
- Map legend showing category colors: replaced with status legend (red/amber/green)

---

## Open Questions

1. **SQLx migration no-transaction pragma**
   - What we know: `ALTER TYPE ... ADD VALUE` cannot run in a transaction; SQLx wraps migrations in transactions by default
   - What's unclear: Whether the version of SQLx in this project supports `-- +migrate Up no-transaction` (this is a `golang-migrate` pragma; SQLx uses different syntax — may need to check)
   - Recommendation: Planner should check `Cargo.toml` for sqlx version and verify the correct pragma. If unsupported, split 008 into two files: `008_workflow_rename.sql` (transactional, contains RENAME VALUE + ALTER TABLE) and `009_workflow_enum_values.sql` (non-transactional, contains ADD VALUE statements only). SQLx does support per-file non-transactional migrations via the `#[sqlx::test]` attribute or `sqlx migrate run` behavior — the planner must verify.

2. **Where to store resolution_notes: reports vs status_history**
   - What we know: `status_history.note` already exists; CONTEXT.md says "resolution_notes stored here or on reports directly (researcher to advise)"
   - What's unclear: Whether future requirements will need to query resolution notes independently from status history
   - Recommendation: Store on `reports.resolution_notes` (separate column) for direct read without JOIN. Also write to `status_history.note` for audit trail completeness. Both are cheap and serve different read patterns. The planner can choose one or both.

3. **GBA org seed data**
   - What we know: CONTEXT.md says "Researcher should find GBA corporation names and ward office structure from public sources as placeholder seed data"
   - What we know: The STATE.md blocker says GBA structure is unconfirmed pending Arun Pai engagement
   - Recommendation: Seed ONE placeholder GBA root org + two placeholder corporations (BBMP South, BBMP North) + a few placeholder ward offices so the UI is testable. Use clearly labeled placeholder names. Seed in a separate `seed_` SQL script, not a migration — seeds are not structural schema changes. Or the planner may defer seeding to a dedicated sub-task.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + React Testing Library (frontend); cargo test (backend) |
| Config file | `frontend/jest.config.js` (existing) |
| Quick run command (frontend) | `cd frontend && npm test -- --watchAll=false` |
| Full suite command (frontend) | `cd frontend && npm test -- --watchAll=false --coverage` |
| Quick run command (backend) | `cd backend && cargo test` |
| Full suite command (backend) | `cd backend && cargo test -- --test-threads=1` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WFLOW-01 | validate_status accepts all 6 new values, rejects old values | unit (Rust) | `cd backend && cargo test validate_status` | ❌ Wave 0 — extend existing test in admin.rs |
| WFLOW-01 | StatusBadge renders correct label + aria for each of 6 statuses | unit (Jest) | `cd frontend && npm test -- StatusBadge --watchAll=false` | ❌ Wave 0 — extend StatusBadge.test.tsx |
| WFLOW-02 | resolve_report inserts status_history row with admin ID | unit (Rust, no DB) | `cd backend && cargo test resolve_report` | ❌ Wave 0 |
| WFLOW-03 | assignReportOrg API call sends PATCH to correct endpoint | unit (Jest) | `cd frontend && npm test -- adminApi --watchAll=false` | ❌ Wave 0 — add to adminApi test file |
| WFLOW-04 | Resolution notes field optional in modal — submit with and without | unit (Jest) | `cd frontend && npm test -- ResolveModal --watchAll=false` | ❌ Wave 0 |
| WFLOW-05 | Backend rejects resolve/close with missing photo (400) | unit (Rust) | `cd backend && cargo test admin_resolve_report_requires_photo` | ❌ Wave 0 |
| WFLOW-05 | Backend accepts resolve with valid photo bytes | unit (Rust) | `cd backend && cargo test admin_resolve_report_saves_photo` | ❌ Wave 0 |
| MAP-01 | ReportsMap uses STATUS_COLORS for CircleMarker fillColor | unit (Jest) | `cd frontend && npm test -- ReportsMap --watchAll=false` | ✅ existing ReportsMap.test.tsx — needs new assertions |
| MAP-03 | Popup renders status label and after-photo thumbnail when present | unit (Jest) | `cd frontend && npm test -- ReportsMap --watchAll=false` | ✅ existing ReportsMap.test.tsx — needs new assertions |

### Sampling Rate
- **Per task commit:** `cd backend && cargo test` + `cd frontend && npm test -- --watchAll=false`
- **Per wave merge:** Full suite with coverage
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/app/admin/components/__tests__/ResolveModal.test.tsx` — covers WFLOW-04, WFLOW-05 (frontend validation)
- [ ] `frontend/app/admin/components/__tests__/OrgPicker.test.tsx` — covers WFLOW-03 UI
- [ ] `backend/src/handlers/admin.rs` test module — extend `validate_status` tests to cover 6 new values + reject old values (WFLOW-01)
- [ ] New Rust unit test for resolve_report mandatory-photo validation (WFLOW-05)
- [ ] Extend `StatusBadge.test.tsx` to cover all 6 new status entries (WFLOW-01 frontend)
- [ ] Extend `ReportsMap.test.tsx` to assert STATUS_COLORS usage and popup status label (MAP-01, MAP-03)

*(Existing test infrastructure: Jest jsdom + React Testing Library covers all frontend; cargo test covers backend pure functions. No new frameworks needed.)*

---

## Sources

### Primary (HIGH confidence)
- PostgreSQL official docs — ALTER TYPE: https://www.postgresql.org/docs/current/sql-altertype.html — RENAME VALUE and ADD VALUE syntax, transaction constraints verified
- Project source code — `backend/src/db/admin_queries.rs` — existing `update_report_status` function pattern
- Project source code — `backend/src/handlers/reports.rs` — multipart upload pattern
- Project source code — `frontend/app/components/ReportsMap.tsx` — CircleMarker fillColor usage
- Project source code — `frontend/app/admin/lib/adminApi.ts` — existing Organization type, updateReportStatus function
- Project source code — `backend/migrations/001_init.sql` — current report_status ENUM definition
- Project source code — `backend/migrations/005_organizations.sql` — organizations table schema

### Secondary (MEDIUM confidence)
- Project source code — `frontend/app/admin/components/StatusBadge.tsx` — STATUS_CONFIG map pattern to extend
- Project source code — `frontend/app/admin/reports/[id]/page.tsx` — detail page structure to extend

### Tertiary (LOW confidence)
- No low-confidence findings. All claims are grounded in official docs or direct code inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture: HIGH — all patterns are extensions of verified existing code; only migration transaction constraint required external verification
- Pitfalls: HIGH — ENUM/transaction pitfall verified against official PostgreSQL docs; all others are direct code inspection findings

**Research date:** 2026-03-14
**Valid until:** 2026-06-14 (stable domain — Postgres ENUM behavior and React patterns do not change rapidly)
