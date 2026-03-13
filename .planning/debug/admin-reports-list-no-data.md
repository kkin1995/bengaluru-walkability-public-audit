---
status: diagnosed
trigger: "Admin Reports List Returns No Data — getAdminReports() returning response where .data is undefined"
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED — JSON shape mismatch between backend and frontend
test: trace the exact key names returned by admin_list_reports handler vs. what getAdminReports() expects
expecting: backend returns { page, limit, count, items } — frontend expects { data, pagination }
next_action: diagnosis complete

## Symptoms

expected: GET /api/admin/reports returns { data: AdminReport[], pagination: { page, limit, total_count, total_pages } }
actual:
  - /admin/reports shows "No reports found" despite 8 reports in DB
  - /admin/reports/map crashes with "TypeError: can't access property 'filter', n is undefined"
errors:
  - "TypeError: can't access property 'filter', n is undefined" (map page)
  - "No reports found" (reports list page)
reproduction: Navigate to /admin/reports or /admin/reports/map while logged into admin portal
started: After Phase 1 plan 02 ward_id changes

## Eliminated

- hypothesis: The report query fails entirely (500 error)
  evidence: Stats endpoint works (shows Total Reports: 8), meaning the DB is fine and the reports table is queryable. If list_admin_reports caused a 500, the handler would return an error body, not a success body with wrong shape.
  timestamp: 2026-03-12

- hypothesis: ward_id addition to Report struct causes SQLx deserialization failure
  evidence: list_admin_reports in admin_queries.rs does NOT use sqlx::query_as::<_, Report>. It uses plain sqlx::query() and manually builds serde_json::Value rows. Therefore adding ward_id to the Report struct has zero effect on this query path.
  timestamp: 2026-03-12

## Evidence

- timestamp: 2026-03-12
  checked: backend/src/handlers/admin.rs lines 418-423 — admin_list_reports handler return value
  found: |
    Ok(Json(serde_json::json!({
        "page": page,
        "limit": limit,
        "count": items.len(),
        "items": items,
    })))
  implication: Handler returns keys "page", "limit", "count", "items" — NOT the shape the frontend expects

- timestamp: 2026-03-12
  checked: frontend/app/admin/lib/adminApi.ts lines 63-71 — AdminReportListResponse interface
  found: |
    export interface AdminReportListResponse {
      data: AdminReport[];
      pagination: {
        page: number;
        limit: number;
        total_count: number;
        total_pages: number;
      };
    }
  implication: Frontend expects keys "data" and "pagination" — a completely different structure

- timestamp: 2026-03-12
  checked: adminApi.ts getAdminReports() usage — result.data
  found: getAdminReports() casts the raw response as AdminReportListResponse. The backend returns { page, limit, count, items }. When cast to AdminReportListResponse, result.data is undefined (key does not exist) and result.pagination is undefined.
  implication: |
    - /admin/reports: code likely does something like `reports = result.data ?? []` → empty array → "No reports found"
    - /admin/reports/map: code likely does `result.data.filter(...)` → TypeError because result.data is undefined → crash

- timestamp: 2026-03-12
  checked: backend/src/db/admin_queries.rs list_admin_reports — SELECT column list
  found: |
    Query selects: id, created_at, image_path, latitude, longitude,
    category::TEXT, severity::TEXT, description, submitter_name,
    submitter_contact, status::TEXT, location_source::TEXT
    — ward_id is NOT in this SELECT
  implication: Even after fixing the shape mismatch, ward_name will be null/absent in results because ward_id is not joined to the wards table. This is a secondary gap (AdminReport.ward_name will always be null). Not a crash bug, but a functional gap.

- timestamp: 2026-03-12
  checked: Whether this is one bug or two separate bugs
  found: Both symptoms (/admin/reports empty list AND /admin/reports/map crash) share identical root cause. Both pages call getAdminReports(), receive { page, limit, count, items } from backend, but expect { data, pagination }. The map page crashes harder because it calls .filter() directly on result.data without a null guard.
  implication: One root cause, two symptoms

## Resolution

root_cause: |
  JSON shape contract mismatch.
  backend/src/handlers/admin.rs admin_list_reports (line 418-423) returns:
    { "page": N, "limit": N, "count": N, "items": [...] }

  frontend/app/admin/lib/adminApi.ts AdminReportListResponse expects:
    { "data": [...], "pagination": { "page", "limit", "total_count", "total_pages" } }

  result.data is always undefined → "No reports found" on list page, TypeError on map page.

fix: |
  TWO valid approaches (one must be chosen):

  OPTION A — Fix backend to match frontend contract (preferred — frontend already typed and tested):
    In backend/src/handlers/admin.rs, change admin_list_reports return to:
      Ok(Json(serde_json::json!({
          "data": items,
          "pagination": {
              "page": page,
              "limit": limit,
              "total_count": items.len(),   // approximate — no total count query currently
              "total_pages": 1,             // approximate — needs separate COUNT(*) query for real pagination
          }
      })))
    Note: For exact total_count and total_pages, a separate COUNT(*) query with the same WHERE clause
    is needed in list_admin_reports. Otherwise total_count == current page's item count,
    which is wrong for pages beyond the first.

  OPTION B — Fix frontend to match backend shape:
    Change AdminReportListResponse to { items: AdminReport[]; page: number; limit: number; count: number }
    Update all callers in /admin/reports/page.tsx and /admin/reports/map/page.tsx

  Secondary gap (non-crashing): list_admin_reports SELECT does not include ward_id or join to wards,
  so ward_name will always be null. Fix requires adding:
    LEFT JOIN wards ON wards.id = reports.ward_id
  to the query and selecting wards.name AS ward_name.

verification: n/a — diagnose-only mode
files_changed: []
