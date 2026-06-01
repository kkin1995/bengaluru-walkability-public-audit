---
phase: 03-government-triage-workflow
reviewed: 2026-05-31T11:45:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - backend/migrations/008_workflow.sql
  - backend/migrations/009_ward_hierarchy.sql
  - backend/migrations/010_org_seed.sql
  - backend/migrations/011_analytics_mv.sql
  - backend/migrations/012_fix_mv_refresh.sql
  - backend/src/models/report.rs
  - backend/src/models/admin.rs
  - backend/src/db/admin_queries.rs
  - backend/src/db/queries.rs
  - backend/src/handlers/admin.rs
  - backend/src/handlers/reports.rs
  - backend/src/main.rs
  - frontend/app/admin/admin.css
  - frontend/app/admin/components/StatusBadge.tsx
  - frontend/app/admin/components/StatusActionPanel.tsx
  - frontend/app/admin/components/OrgAssignPanel.tsx
  - frontend/app/admin/components/GbaHierarchyPanel.tsx
  - frontend/app/admin/components/ResolveModal.tsx
  - frontend/app/admin/components/ReportsTable.tsx
  - frontend/app/admin/lib/adminApi.ts
  - frontend/app/admin/reports/[id]/page.tsx
  - frontend/app/admin/reports/page.tsx
  - frontend/app/components/ReportsMap.tsx
  - frontend/app/map/page.tsx
  - frontend/app/reports/[id]/page.tsx
  - frontend/app/lib/config.ts
findings:
  critical: 5
  warning: 7
  info: 3
  total: 15
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-31T11:45:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

This review covers the Phase 03 government-triage-workflow implementation: status enum migration, org assignment, resolve endpoint with mandatory after-photo, materialized view refresh, GBA hierarchy display, and the admin detail page. The core workflow logic is architecturally sound — transactions are used correctly, JWT claims are validated, EXIF stripping is applied to resolution photos, and path-traversal guards are in place.

Five blockers were found: two enum divergences between the DB schema and application code (stats seeds and validate_category disagree with the actual issue_category and severity_level DB enums), a missing `ward_number` field in the admin report detail response that causes the frontend WardHierarchy type to always receive `null` for that field, a missing trigger for `DELETE` events on the materialized view (deleted reports never decrement the count), and a stale-closure risk in the ResolveModal cleanup effect. Seven warnings cover the no-validation of org_id existence before assignment, the incomplete error message thrown from apiFetch, a double-URL-revoke edge case, missing JPEG validation on resolution photos, and a few other robustness issues.

---

## Critical Issues

### CR-01: Stats seeds reference enum values that do not exist in the DB schema

**File:** `backend/src/db/admin_queries.rs:815-830`

**Issue:** `get_report_stats` pre-seeds `by_category` with `"no_curb_ramp"` and `"encroachment"`, and `by_severity` with `"critical"`. The actual PostgreSQL `issue_category` enum (migration `001_init.sql`) contains only `no_footpath`, `broken_footpath`, `blocked_footpath`, `unsafe_crossing`, `poor_lighting`, `other`. The `severity_level` enum contains only `low`, `medium`, `high`. Neither `no_curb_ramp`, `encroachment`, nor `critical` exist in the DB. The seeded keys will never be overwritten by the GROUP BY query (because no rows have those values), so the stats API permanently returns phantom zero-counts for non-existent enum values and the real enum count map is inconsistent with the DB schema. Any downstream consumer (charts, exports) that iterates `by_category` will see spurious keys.

**Fix:**
```rust
// backend/src/db/admin_queries.rs — get_report_stats()
// Correct by_category seed — matches 001_init.sql issue_category enum exactly:
let mut by_category: std::collections::HashMap<String, i64> = [
    "no_footpath",
    "broken_footpath",
    "blocked_footpath",
    "unsafe_crossing",
    "poor_lighting",
    "other",
]
.iter()
.map(|k| (k.to_string(), 0))
.collect();

// Correct by_severity seed — matches 001_init.sql severity_level enum exactly:
let mut by_severity: std::collections::HashMap<String, i64> =
    ["low", "medium", "high"]
        .iter()
        .map(|k| (k.to_string(), 0))
        .collect();
```

---

### CR-02: validate_category rejects two enum values that do not exist in the DB, and accepts the DB's full set

**File:** `backend/src/handlers/admin.rs:128-134`

**Issue:** `validate_category` matches `"no_footpath" | "broken_footpath" | "blocked_footpath" | "unsafe_crossing" | "poor_lighting" | "other"`. This is correct for the DB schema. However, the stats seed in `admin_queries.rs` adds `"no_curb_ramp"` and `"encroachment"` as if they were valid categories (CR-01 above). These two functions are in direct contradiction. When both bugs coexist, a user filtering by `no_curb_ramp` will be rejected at the API layer (400 Bad Request) yet the stats endpoint will always return `"no_curb_ramp": 0` as if it were valid. The category validation in `validate_category` is correct per the DB schema, but the discrepancy with the stats seed creates a confusing and inconsistent API surface. Additionally, `validate_severity` in the same file rejects `"critical"`, but the stats seed adds it (same CR-01 pattern). Fix CR-01 to align the seeds with the schema.

**Fix:** Fix is the same as CR-01 — remove phantom values from the stats seeds so they match the actual DB enums. No change needed to `validate_category` or `validate_severity` themselves.

---

### CR-03: `ward_number` is missing from the admin report detail `ward_hierarchy` JSON — type contract broken

**File:** `backend/src/db/admin_queries.rs:568-583`

**Issue:** The `get_admin_report_by_id` function builds the `ward_hierarchy` JSON object (lines 568–583) but does not include `ward_number`. The frontend `WardHierarchy` interface in `adminApi.ts:52` declares `ward_number: number | null` as a required field of the hierarchy. The `GbaHierarchyPanel` component reads `hierarchy.ward_number` to build the ward display string. Because the backend never emits this key, the frontend always receives `undefined` (treated as `null`), so the ward display always shows only `ward_name` without its number, breaking the `"ward_number · ward_name"` format the component is designed to render. The `w.ward_number` column IS joined (the `wards` table is already LEFT JOINed in the query), so this is simply a missing key in the `serde_json::json!({...})` literal.

**Fix:**
```rust
// backend/src/db/admin_queries.rs — inside get_admin_report_by_id(), ward_hierarchy block
let ward_hierarchy = if ward_id.is_some() {
    serde_json::json!({
        "ward_name":                  r.get::<Option<String>, _>("ward_name"),
        "ward_number":                r.try_get::<Option<i32>, _>("ward_number").unwrap_or(None), // ADD THIS
        "zone_name":                  r.get::<Option<String>, _>("zone_name"),
        // ... rest unchanged
    })
} else {
    serde_json::Value::Null
};
```
Also add `w.ward_number` to the SELECT list in the same query at line 498.

---

### CR-04: Materialized view trigger does not fire on DELETE — deleted reports inflate `total_reports` permanently

**File:** `backend/migrations/011_analytics_mv.sql:67-71`

**Issue:** The `trg_refresh_public_stats` trigger is declared as `AFTER INSERT OR UPDATE ON reports`. It does not include `DELETE`. When an admin deletes a report (via `admin_delete_report`), the materialized view `public_stats_mv` is not refreshed. The `total_reports` count in the public stats endpoint will remain stale (over-counted) until the next INSERT or UPDATE on `reports` triggers a refresh. For a civic-audit application where reports are periodically deleted as duplicates or invalid submissions, this means the public-facing report count is permanently wrong after any deletion.

**Fix:** Add `OR DELETE` to the trigger definition in migration 012 (or a new migration 013):
```sql
-- Add this as a new migration (013) or extend 012:
DROP TRIGGER IF EXISTS trg_refresh_public_stats ON reports;
CREATE TRIGGER trg_refresh_public_stats
AFTER INSERT OR UPDATE OR DELETE ON reports
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_public_stats_mv();
```

---

### CR-05: ResolveModal cleanup effect has a stale-closure bug — `photoPreviewUrl` cleanup races with state reset

**File:** `frontend/app/admin/components/ResolveModal.tsx:36-43`

**Issue:** The first `useEffect` (lines 36–43) runs `URL.revokeObjectURL(photoPreviewUrl)` in the cleanup function when `photoPreviewUrl` changes. However:
1. The dependency array is `[photoPreviewUrl]`, so the cleanup fires when the URL changes — this revokes the *previous* URL, which is correct.
2. But the second `useEffect` (lines 46–58) also calls `URL.revokeObjectURL(photoPreviewUrl)` on `open` change, using the `photoPreviewUrl` captured at the time `open` becomes `false`. If a rapid `open → false → true` sequence occurs, the first effect's cleanup and the second effect's cleanup can both attempt to revoke the same URL object, resulting in a double-revoke. While `URL.revokeObjectURL` is idempotent for already-revoked URLs, the second effect references `photoPreviewUrl` via closure without listing it as a dependency (the `eslint-disable-next-line` suppresses the warning). If `photoPreviewUrl` changes between the `open` transition and the effect running, the second effect revokes the *new* URL, not the one that was shown when the modal closed.

The root cause is that both effects operate on `photoPreviewUrl` but the second effect explicitly suppresses the dependency. The stale closure makes the second cleanup unreliable.

**Fix:** Use a ref to track the active object URL so revocation is unconditionally safe:
```tsx
const previewUrlRef = useRef<string | null>(null);

// On file change:
if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
const newUrl = URL.createObjectURL(file);
previewUrlRef.current = newUrl;
setPhotoPreviewUrl(newUrl);

// Single cleanup effect:
useEffect(() => {
  return () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  };
}, []); // unmount only
```

---

## Warnings

### WR-01: `assign_report_org` does not validate that the supplied `org_id` exists in the `organizations` table

**File:** `backend/src/db/admin_queries.rs:733-781`

**Issue:** `assign_report_org` executes `UPDATE reports SET assigned_org_id = $1 WHERE id = $2` where `$1` is the org_id from the request. The FK constraint `assigned_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL` will cause a PostgreSQL foreign-key violation error if a non-existent UUID is supplied. This error propagates as `AppError::Database`, which returns an HTTP 500 rather than a meaningful 404 or 400. An admin who mis-types or supplies a stale org UUID gets an opaque 500 error instead of `"Organization not found"`.

**Fix:** Add an existence check before the UPDATE, or catch the FK violation error code (`23503`) and map it to `AppError::BadRequest("Organization not found")`, similar to how `create_admin_user` maps `23505` to `AppError::Conflict`.

---

### WR-02: `apiFetch` error message loses response body — 400/409 error details are never surfaced to the UI

**File:** `frontend/app/admin/lib/adminApi.ts:151-153`

**Issue:** The `apiFetch` helper throws `new Error(\`HTTP ${res.status}\`)` on any non-2xx response. Backend 400 errors (e.g. "Resolution photo required", "Invalid status") include a descriptive JSON or text body that would be useful to the user. Since the body is never read, the ResolveModal (and all other components that catch errors from `apiFetch`) can only display raw strings like `"HTTP 400"`, which is meaningless to end-users.

**Fix:**
```ts
if (!res.ok) {
  let detail = "";
  try { detail = await res.text(); } catch { /* ignore */ }
  throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
}
```

---

### WR-03: Resolution photo is not validated as JPEG before EXIF stripping — non-JPEG files reach `strip_exif` and return a misleading error

**File:** `backend/src/handlers/admin.rs:678-683`

**Issue:** `admin_resolve_report` collects the resolution photo bytes and calls `strip_exif(&photo_bytes)` without first checking JPEG magic bytes (`0xFF 0xD8`). The `create_report` handler correctly validates with `is_jpeg()` before calling `strip_exif`. The resolve handler skips this check. If an admin accidentally uploads a PNG or WEBP as the resolution photo, `img-parts::Jpeg::from_bytes` will fail and the handler returns `AppError::BadRequest("Image processing failed: not a valid JPEG")` — but this error message is only exposed if `apiFetch` reads the body (see WR-02). More importantly, validation is inconsistent across both photo-upload paths.

**Fix:** Add the same magic-byte check as `create_report`:
```rust
// After collecting photo_bytes, before strip_exif:
if !crate::handlers::reports::is_jpeg(&photo_bytes) {
    return Err(AppError::BadRequest("Only JPEG images are accepted".into()));
}
```
`is_jpeg` is currently private; expose it as `pub(crate)` similar to `strip_exif`.

---

### WR-04: `OrgAssignPanel` in view mode reads `assignedCorp` from an unloaded `orgs` list — always shows `null` corporation on initial render

**File:** `frontend/app/admin/components/OrgAssignPanel.tsx:53-58`

**Issue:** The `assignedCorp` and `assignedOrg` lookups (lines 53–58) depend on the in-memory `orgs` list, which is `null` until the user switches to edit mode. In view mode, `orgs` is `null`, so `assignedOrg` is always `null`, `assignedCorp` is always `null`, and the display falls back to showing only `assignedOrgName` (a flat string) rather than the `"Corporation ↳ Ward Office"` cascade. This means the corp/ward-office hierarchy is never displayed in view mode on initial load. The `assigned_org_name` from the server gives the ward office name, but the corporation parent is never shown until the user clicks "Change" (loading orgs).

**Fix:** Either pre-fetch orgs on component mount (not just on edit mode entry), or expand the backend to return `assigned_corp_name` alongside `assigned_org_name` in the report response so view mode can display the cascade without a client fetch.

---

### WR-05: `admin_resolve_report` writes the photo file before the DB transaction — orphaned files accumulate if the DB call fails after `rows_affected() == 0`

**File:** `backend/src/handlers/admin.rs:725-743`

**Issue:** The handler writes the photo to disk (`tokio::fs::write`) at line 725, then calls `resolve_report(...)` which opens a transaction. If the DB UPDATE finds no matching report (`rows_affected() == 0`), the handler correctly deletes the written file (line 743). However, if `resolve_report` returns `Ok(false)` after a *partial* transaction (the UPDATE executes but `status_history` INSERT fails, causing a rollback), the file has already been written but `Ok(false)` is returned, so the file cleanup at line 743 runs and the file is deleted — this path is actually safe. But if `resolve_report` itself returns `Err(...)` (e.g. a DB connection error mid-transaction), the `?` operator returns early from the handler at line 731, and the cleanup block at line 743 is never reached. The written file is permanently orphaned on disk.

**Fix:** Use a `scopeguard` or explicit cleanup on early return from error:
```rust
let found = admin_queries::resolve_report(...).await;
match found {
    Err(e) => {
        let _ = tokio::fs::remove_file(&write_path).await;
        return Err(e);
    }
    Ok(false) => {
        let _ = tokio::fs::remove_file(&write_path).await;
        return Err(AppError::NotFound);
    }
    Ok(true) => {}
}
```

---

### WR-06: `admin_list_reports` does N+1 pattern — fetches calling admin's `org_id` on every paginated request

**File:** `backend/src/handlers/admin.rs:460-464`

**Issue:** Every call to `GET /api/admin/reports` fetches the entire `AdminUser` row from the database just to extract `org_id`. This adds a SELECT query per paginated list request. At the current scale this is acceptable, but for an admin user with `org_id = None` (unscoped super-admin), it is entirely unnecessary since the org_id is always None. The JWT claims already carry `sub`, `email`, `role`, and `exp`, but not `org_id`, which is the stated reason for the per-request fetch. This design is fragile — the comment acknowledges it but the implication is a DB roundtrip on every admin page load.

**Fix (short term):** Cache the org_id in the JWT claims and re-issue tokens on org assignment changes, or add `org_id` to the JWT payload. This is a design trade-off explicitly acknowledged in the comment; flagging it here as a warning for the next design iteration.

---

### WR-07: `count_admin_reports` parameter index for `org_id` is off-by-one when `where_clause` is empty

**File:** `backend/src/db/admin_queries.rs:244-305`

**Issue:** `count_admin_reports` builds a `WITH RECURSIVE org_subtree` CTE where the CTE parameter index is `param_idx` (starts at 1 when there are no filter conditions). When the filter WHERE clause is empty and `org_id` is `Some`, `param_idx` is still 1 (the build function returns `next_idx = 1` when no conditions exist). The CTE uses `$1` for `org_id`. Then the bind order is: no filter values → `org_id` bound last. This is correct, and `param_idx = 1` → org_id binds at `$1`.

BUT the CTE is prepended as `cte_prefix` and appended BEFORE the main WHERE clause. The full WHERE built is `format!("{}{}", where_clause, org_clause)`. When `where_clause` is empty (`""`), `org_clause` is `" AND reports.ward_id IN (SELECT w.id FROM wards w JOIN org_subtree s ON w.org_id = s.id)"`. The final SQL has no standalone `WHERE` keyword — it starts with `AND`, which is invalid SQL syntax. The `count_admin_reports` SQL becomes:
```sql
WITH RECURSIVE org_subtree AS (...) SELECT COUNT(*) FROM reports LEFT JOIN wards ...
AND reports.ward_id IN (...)
```
This is a SQL syntax error when `org_id` is Some but no other filters are provided. The same issue exists in `list_admin_reports` (line 351) with the same `format!("{}{}", where_clause, org_clause)` pattern.

**Fix:** The `org_clause` must be appended with a proper `WHERE` prefix when `where_clause` is empty:
```rust
let full_where = if where_clause.is_empty() && !org_clause.is_empty() {
    // org_clause starts with " AND ..." — prepend WHERE
    format!("WHERE{}", &org_clause[" AND".len()..]) // "WHERE reports.ward_id IN ..."
} else {
    format!("{}{}", where_clause, org_clause)
};
```

---

## Info

### IN-01: `admin/reports/[id]/page.tsx` accesses `params.id` directly — should use `React.use(params)` in Next.js 15+

**File:** `frontend/app/admin/reports/[id]/page.tsx:148-149`

**Issue:** The page component destructures `params.id` synchronously as `{ params }: { params: { id: string } }`. In Next.js 14 App Router with `"use client"`, this is currently valid. However, Next.js 15 deprecates synchronous access to `params` in client components and requires `React.use(params)`. This is a forward-compatibility warning; it does not cause a bug in Next.js 14 but will generate warnings in 15 and break in a future version.

**Fix:** Wrap params access in `React.use()` or use the `useParams()` hook from `next/navigation`.

---

### IN-02: `ResolveModal` accepts PNG from the file picker but the backend rejects non-JPEG files

**File:** `frontend/app/admin/components/ResolveModal.tsx:264`

**Issue:** The hidden file input accepts `accept="image/jpeg,image/jpg,image/png,image/*"` and the `handleFileChange` only checks `file.type.startsWith("image/")`. PNG and WEBP files pass client-side validation but will be rejected by the backend's `strip_exif` call (see WR-03) with a generic error message. The UI says "JPEG or PNG" but the backend only accepts JPEG. This inconsistency will confuse admins who upload a PNG resolution photo and receive a cryptic server error.

**Fix:** Align the accept attribute and client-side check with the backend constraint:
```tsx
accept="image/jpeg,image/jpg"
// and in handleFileChange:
if (!file.type.startsWith("image/jpeg") && file.type !== "image/jpg") {
  setError("Please select a JPEG image file.");
  return;
}
```

---

### IN-03: `admin_queries.rs` `ADMIN_REPORT_DEDUP_COLS` constant is marked as `pub` but is only used within the module — unnecessary API surface exposure

**File:** `backend/src/db/admin_queries.rs:1050`

**Issue:** `pub const ADMIN_REPORT_DEDUP_COLS` is accessible from all crates but is used only within `admin_queries.rs` (in `list_admin_reports`) and in the inline test module. Making it `pub` exposes an implementation detail. `pub(crate)` or even `pub(super)` would be sufficient.

**Fix:**
```rust
pub(crate) const ADMIN_REPORT_DEDUP_COLS: &str = ...;
```

---

_Reviewed: 2026-05-31T11:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
