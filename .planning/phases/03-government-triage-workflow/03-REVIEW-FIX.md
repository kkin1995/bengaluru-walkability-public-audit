---
phase: 03-government-triage-workflow
fixed_at: 2026-05-31T12:30:00Z
review_path: .planning/phases/03-government-triage-workflow/03-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 11
skipped: 1
status: partial
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-31T12:30:00Z
**Source review:** .planning/phases/03-government-triage-workflow/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 12 (CR-01 through CR-05, WR-01 through WR-07)
- Fixed: 11
- Skipped: 1 (WR-06 — design decision required)

---

## Fixed Issues

### CR-01 / CR-02: Stats seeds reference phantom enum values

**Files modified:** `backend/src/db/admin_queries.rs`
**Commit:** `60090f8`
**Applied fix:** Removed `no_curb_ramp` and `encroachment` from `by_category` seed (not in DB `issue_category` enum). Removed `critical` from `by_severity` seed (not in DB `severity_level` enum). Seeds now match `001_init.sql` enums exactly: `no_footpath`, `broken_footpath`, `blocked_footpath`, `unsafe_crossing`, `poor_lighting`, `other` for categories; `low`, `medium`, `high` for severity. CR-02 required no additional change — `validate_category` and `validate_severity` were already correct; the fix to CR-01 seeds resolves the contradiction.

---

### CR-03: `ward_number` missing from admin report detail `ward_hierarchy` JSON

**Files modified:** `backend/src/db/admin_queries.rs`
**Commit:** `1c687b8`
**Applied fix:** Added `w.ward_number` to the SELECT list in `get_admin_report_by_id`. Added `"ward_number": r.try_get::<Option<i32>, _>("ward_number").unwrap_or(None)` to the `ward_hierarchy` JSON object. Frontend `WardHierarchy` interface declares `ward_number: number | null` as required; the missing key caused the ward display to always render without its number.

---

### CR-04: Materialized view trigger does not fire on DELETE

**Files modified:** `backend/migrations/013_fix_delete_trigger.sql` (new file)
**Commit:** `3e024d9`
**Applied fix:** Created migration `013_fix_delete_trigger.sql` that drops and recreates `trg_refresh_public_stats` as `AFTER INSERT OR UPDATE OR DELETE ON reports FOR EACH STATEMENT`. Previously the trigger only fired on INSERT or UPDATE, so deleted reports permanently inflated `total_reports` in the public stats endpoint.

---

### CR-05: ResolveModal cleanup effect stale-closure bug

**Files modified:** `frontend/app/admin/components/ResolveModal.tsx`
**Commit:** `f22f312`
**Applied fix:** Added `previewUrlRef = useRef<string | null>(null)` to track the active object URL. Replaced the two-effect pattern (one per `photoPreviewUrl` change, one per `open` change, both with suppressed eslint-deps) with: (1) a single unmount-only cleanup effect that revokes via ref, and (2) an open-change effect that revokes via ref before resetting state. Updated `handleFileChange` and `handleRemovePhoto` to set/clear `previewUrlRef.current` alongside state. The stale-closure risk on rapid open→false→true transitions is eliminated.
**Note:** Fix involves stateful React cleanup logic — requires human verification that ref lifecycle is correct under all open/close sequences.

---

### WR-01: `assign_report_org` returns 500 on non-existent org_id

**Files modified:** `backend/src/db/admin_queries.rs`
**Commit:** `717f259`
**Applied fix:** Wrapped the `execute` call with `.map_err` that detects PostgreSQL error code `23503` (foreign-key violation) and returns `AppError::BadRequest("Organization not found")` instead of `AppError::Database`. This returns HTTP 400 to callers, consistent with how `create_admin_user` maps `23505` to `AppError::Conflict`.

---

### WR-02: `apiFetch` error message loses response body

**Files modified:** `frontend/app/admin/lib/adminApi.ts`
**Commit:** `f260120`
**Applied fix:** Added `try { detail = await res.text(); } catch {}` in the `!res.ok` branch and appended `detail` to the thrown error message: `HTTP ${res.status}: ${detail}`. Backend 400/409 error bodies (e.g. "Resolution photo required", "Organization not found") now surface in the UI error display.

---

### WR-03: Non-JPEG files reach `strip_exif` in resolution photo upload

**Files modified:** `backend/src/handlers/reports.rs`, `backend/src/handlers/admin.rs`
**Commit:** `3cefaa9`
**Applied fix:** Changed `fn is_jpeg` to `pub(crate) fn is_jpeg` in `reports.rs`. Added magic-byte check in `admin_resolve_report` immediately after `validate_resolve_request`: `if !photo_bytes.is_empty() && !crate::handlers::reports::is_jpeg(&photo_bytes)` returns `AppError::BadRequest("Only JPEG images are accepted for resolution photos")`. Mirrors the identical check in `create_report`.

---

### WR-04: `OrgAssignPanel` never shows corp cascade in view mode

**Files modified:** `frontend/app/admin/components/OrgAssignPanel.tsx`
**Commit:** `165a0d3`
**Applied fix:** Removed the `mode === "edit"` guard from the orgs fetch `useEffect`. Orgs are now fetched on component mount (when `orgs === null`) regardless of mode. Previously, `orgs` was always `null` in view mode so `assignedCorp` was always `null` and the full corporation↳ward-office cascade was never displayed.

---

### WR-05: Orphaned photo file on DB error in resolve handler

**Files modified:** `backend/src/handlers/admin.rs`
**Commit:** `e2dc9af`
**Applied fix:** Replaced `.await?` on `resolve_report` with explicit `match` that handles both `Err(e)` (calls `tokio::fs::remove_file(&write_path)` then returns `Err(e)`) and `Ok(false)` (calls `remove_file` then returns `Err(AppError::NotFound)`). The `Ok(true)` arm continues normally. Previously, the `?` operator early-returned on `Err` without cleanup, leaving the written photo permanently orphaned on disk.

---

### WR-07: SQL syntax error in count/list when org_id is Some and no other filters

**Files modified:** `backend/src/db/admin_queries.rs`
**Commit:** `eda3db8`
**Applied fix:** Applied the same fix to both `count_admin_reports` and `list_admin_reports`. The `org_clause` starts with `" AND ..."` — when `where_clause` is empty (no category/status/severity/date filters), the combined SQL had no `WHERE` keyword before `AND`, which is invalid SQL. Now: `if where_clause.is_empty() && !org_clause.is_empty() { format!("WHERE{}", &org_clause[" AND".len()..]) }` to produce valid `WHERE reports.ward_id IN (...)` SQL.

---

## Skipped Issues

### WR-06: N+1 org_id lookup on every paginated admin reports request

**File:** `backend/src/handlers/admin.rs:460-464`
**Reason:** Design decision required — the reviewer explicitly states this is a "design trade-off explicitly acknowledged in the comment; flagging it here as a warning for the next design iteration." Options include caching org_id in the JWT or adding org_id to the JWT payload, both of which affect the auth subsystem and require a coordinated design decision. Classified as `manual-only` per CLAUDE.md rules.
**Original issue:** Every `GET /api/admin/reports` call fetches the full `AdminUser` row to extract `org_id`, adding a SELECT per paginated list request. Super-admin users (org_id = None) incur this roundtrip unnecessarily.

---

_Fixed: 2026-05-31T12:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
