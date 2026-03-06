# Admin Report Management — Acceptance Criteria
# Document ID: AC-ADMIN-RPT
# Version: 1.0
# Date: 2026-03-06
# Author: PRD-to-AC Converter Agent
# Status: DRAFT — Pending product team resolution of open assumptions below

---

## Schema Discrepancy Notices

The PRD's "DB Schema Reference" section does not match the actual committed migration
(`backend/migrations/001_init.sql`). The following discrepancies affect AC precision.
Treat each as an `[ASSUMPTION]` until the product team confirms the target state.

| # | PRD States | Actual Schema (001_init.sql) | Impact |
|---|------------|------------------------------|--------|
| SD-1 | Columns named `lat`, `lng` | Columns named `latitude`, `longitude` | All ACs use `latitude`/`longitude` |
| SD-2 | `severity_level`: low, medium, high, critical | `severity_level`: low, medium, high (no `critical`) | `by_severity` stats response omits `critical` |
| SD-3 | `issue_category`: 7 values incl. `missing_footpath`, `obstruction`, `flooding` | `issue_category`: 6 values: `no_footpath`, `broken_footpath`, `blocked_footpath`, `unsafe_crossing`, `poor_lighting`, `other` | `by_category` stats keys use actual enum values |
| SD-4 | `status_history.changed_by UUID REFERENCES admin_users(id)` exists | `status_history` has no `changed_by` column; no `admin_users` table in any migration | `002_admin.sql` is referenced but does not exist |
| SD-5 | `reports` has no `submitter_name` | Actual schema has separate `submitter_name TEXT` column | `AdminReport` response must include `submitter_name` |

All ACs in this document use the **actual committed schema** as the source of truth.
Where `002_admin.sql` behavior is assumed, the assumption is labeled explicitly.

---

## Open Assumptions

| ID | Question | Option A | Option B | Option C |
|----|----------|----------|----------|----------|
| ASSUMPTION-ADM-1 | Does `002_admin.sql` exist / will it be created as part of this feature? | Yes — migration must be specced and authored alongside admin endpoints | No — `status_history.changed_by` column and `admin_users` table are deferred; log admin UUID in application layer only (no FK) | No — omit `changed_by` tracking entirely for MVP |
| ASSUMPTION-ADM-2 | JWT authentication mechanism: where is the token stored and how is it validated? | HttpOnly cookie named `wb_admin_token` (SameSite=Strict) | Bearer token in `Authorization` header | Either accepted (cookie preferred; header as fallback) |
| ASSUMPTION-ADM-3 | JWT claims shape: what field names carry role and subject? | `{ sub: "<admin-user-uuid>", role: "admin" \| "reviewer", exp: <unix-ts> }` | `{ sub: "<uuid>", roles: ["admin"] }` (array) | Product team to provide the JWT schema |
| ASSUMPTION-ADM-4 | What constitutes a valid `reviewer` vs `admin` role — are these the only two roles? | Exactly two roles: `admin` (full CRUD) and `reviewer` (read + status update, no delete) | Three roles: `admin`, `reviewer`, `viewer` (read-only) | Roles defined externally (LDAP/SSO); map to these two for authorization |
| ASSUMPTION-ADM-5 | Default `limit` for `GET /api/admin/reports` if `?limit` is absent | 20 (consistent with public endpoint default) | 50 | 100 |
| ASSUMPTION-ADM-6 | Maximum `limit` cap for `GET /api/admin/reports` | 200 (consistent with P2-4 spec) | 500 | No cap (admin-internal tool) |
| ASSUMPTION-ADM-7 | What happens when `date_from` > `date_to`? | Return HTTP 400 with error code WB-ADM-011 | Return empty result set with HTTP 200 | Swap silently and apply |
| ASSUMPTION-ADM-8 | Are `date_from` / `date_to` inclusive bounds? | Both inclusive | `date_from` inclusive, `date_to` exclusive | Both exclusive |
| ASSUMPTION-ADM-9 | File deletion failure on DELETE: after logging warning and deleting DB row, what is the response? | 204 No Content (DB delete succeeded; file cleanup is best-effort) | 207 Multi-Status with body listing file-cleanup failure | 500 Internal Server Error (treat file + DB as atomic) |
| ASSUMPTION-ADM-10 | Can the `note` field in PATCH /status exceed a length limit? | Max 2000 characters; 400 if exceeded | Max 500 characters | No length limit |
| ASSUMPTION-ADM-11 | What does `GET /api/admin/stats` return when the database has zero reports? | Returns all counts as 0 with empty maps: `{ total_reports: 0, by_status: { submitted: 0, under_review: 0, resolved: 0 }, by_category: {}, by_severity: {} }` | Returns HTTP 204 No Content | Returns HTTP 200 with `null` for all fields |
| ASSUMPTION-ADM-12 | Does PATCH /status allow a no-op transition (e.g., status is already `resolved`, PATCH sends `resolved`)? | Allowed — insert a `status_history` row with `old_status = new_status`; return 200 with current report | Allowed — return 200 but do NOT insert a redundant `status_history` row | Return 409 Conflict |
| ASSUMPTION-ADM-13 | What is the `changed_by` value in `status_history` when `002_admin.sql` is not yet applied (SD-4)? | Column does not exist; this field is omitted until migration runs | Use application-layer logging (not DB field) for interim | Block PATCH /status until `002_admin.sql` is applied |
| ASSUMPTION-ADM-14 | Are admin endpoints served under the same origin as public endpoints (port 3001 / same Axum router)? | Yes — same Axum router, `/api/admin/*` route group, same origin | Separate service / separate port | Same Axum router but separate binary feature flag |
| ASSUMPTION-ADM-15 | Session expiry behavior: when the JWT is expired, should the response be 401 with a distinct body or the same 401 body as missing-token? | Distinct: expired token returns 401 with `{ error: "TOKEN_EXPIRED" }`; missing token returns 401 with `{ error: "NO_TOKEN" }` | Same 401 body for all authentication failures | 401 with `WWW-Authenticate` header per RFC 7235 |

---

## 1. Feature Overview

The Admin Report Management subsystem provides privileged REST endpoints at `/api/admin/*`
that allow authenticated operators (roles: `admin` or `reviewer`) to list, inspect, update,
delete, and aggregate citizen walkability reports. These endpoints are richer than the public
`/api/reports` counterparts: they expose exact GPS coordinates without rounding, include the
`submitter_contact` and `submitter_name` fields (PII), support richer filter combinations,
and allow status lifecycle management with an audit trail. Delete operations are restricted
to the `admin` role. All endpoints require a valid JWT; unauthenticated or insufficiently
privileged requests must be rejected before any data access occurs.

---

## 2. Requirements List

### Endpoint: GET /api/admin/reports

| ID | Requirement |
|----|-------------|
| R1 | The endpoint must reject requests with no JWT or an invalid/expired JWT with HTTP 401 before executing any DB query. |
| R2 | The endpoint must return a paginated list of reports for authenticated users with role `admin` or `reviewer`. |
| R3 | Each report in the response must include exact `latitude` and `longitude` values (no rounding), `submitter_contact`, and `submitter_name`. |
| R4 | The response must exclude exact coordinates and PII fields (`submitter_contact`, `submitter_name`) from any public-facing cache layer or response log. |
| R5 | The endpoint must support independent filter parameters: `category`, `status`, `severity`, `date_from`, `date_to`. Filters are ANDed when multiple are provided. |
| R6 | The endpoint must support pagination via `page` (1-indexed) and `limit` query parameters. |
| R7 | Results must be sorted by `created_at DESC` by default. No alternative sort is required for this version. |
| R8 | The endpoint must return HTTP 400 with an error body when any filter parameter carries an invalid value (e.g., `category=banana`, `status=pending`). |

### Endpoint: GET /api/admin/reports/:id

| ID | Requirement |
|----|-------------|
| R9 | The endpoint must reject unauthenticated requests with HTTP 401 before executing any DB query. |
| R10 | The endpoint must return the full report detail — including exact `latitude`, `longitude`, `submitter_contact`, and `submitter_name` — for authenticated users with role `admin` or `reviewer`. |
| R11 | The endpoint must return HTTP 404 with a standard error body when no report with the given UUID exists. |
| R12 | The endpoint must return HTTP 400 when the `:id` path parameter is not a valid UUID v4 string. |

### Endpoint: PATCH /api/admin/reports/:id/status

| ID | Requirement |
|----|-------------|
| R13 | The endpoint must reject unauthenticated requests with HTTP 401 before executing any DB query. |
| R14 | The endpoint must accept a JSON request body containing `status` (required, string) and `note` (optional, string). |
| R15 | The endpoint must validate that `status` is one of exactly three values: `submitted`, `under_review`, `resolved`. Any other value must produce HTTP 400. |
| R16 | On a valid request, the system must update `reports.status` to the new value and set `reports.updated_at` to the current timestamp. |
| R17 | On a valid request, the system must insert a row into `status_history` recording `old_status`, `new_status`, and `note` (nullable). The `changed_by` field behavior is governed by ASSUMPTION-ADM-1 / ASSUMPTION-ADM-13. |
| R18 | The response must be HTTP 200 containing the full updated report (same shape as R10). |
| R19 | The endpoint must return HTTP 404 when the report UUID does not exist. |
| R20 | The endpoint must return HTTP 400 when the `:id` path parameter is not a valid UUID v4 string. |
| R21 | The endpoint must return HTTP 400 when `note` exceeds the maximum allowed length (see ASSUMPTION-ADM-10). |
| R22 | The endpoint must return HTTP 400 when the request body is missing or is not valid JSON. |

### Endpoint: DELETE /api/admin/reports/:id

| ID | Requirement |
|----|-------------|
| R23 | The endpoint must reject unauthenticated requests with HTTP 401 before executing any DB query. |
| R24 | The endpoint must return HTTP 403 when the authenticated user's role is `reviewer`. The DB row must not be deleted. |
| R25 | The endpoint must attempt to delete the image file at `UPLOADS_DIR/<image_path>` before or after deleting the DB row (order is governed by ASSUMPTION-ADM-9). |
| R26 | If the file does not exist on the filesystem or the delete call fails, the system must log a warning (including the report ID and file path) but must still delete the DB row. |
| R27 | Deleting the DB row must cascade to all `status_history` rows for that report (enforced by the `ON DELETE CASCADE` foreign key). |
| R28 | On success, the endpoint must return HTTP 204 No Content with an empty body. |
| R29 | The endpoint must return HTTP 404 when the report UUID does not exist. |
| R30 | The endpoint must return HTTP 400 when the `:id` path parameter is not a valid UUID v4 string. |

### Endpoint: GET /api/admin/stats

| ID | Requirement |
|----|-------------|
| R31 | The endpoint must reject unauthenticated requests with HTTP 401 before executing any DB query. |
| R32 | The endpoint must return aggregate counts accessible to both `admin` and `reviewer` roles. |
| R33 | The response body must include `total_reports` (integer), `by_status` (object with keys `submitted`, `under_review`, `resolved` and integer values), `by_category` (object with one key per `issue_category` enum value and integer values), and `by_severity` (object with one key per `severity_level` enum value and integer values). |
| R34 | Categories or severities with zero reports must still appear in the response with value `0`. |
| R35 | The response must reflect the current state of the database at query time (no stale cache beyond the duration of ASSUMPTION-ADM-14's chosen architecture). |

---

## 3. Acceptance Criteria

### R1 — Authentication gate, GET /api/admin/reports

**AC-RPT-01 (Success path — valid token)**
```
Given: A request to GET /api/admin/reports
  And: The request carries a valid, non-expired JWT (cookie or header per ASSUMPTION-ADM-2)
  And: The JWT claims contain role = "admin" or role = "reviewer"
When: The server receives the request
Then: The server returns HTTP 200
  And: The response Content-Type is application/json
  And: The response body contains a `data` array and a `pagination` object
  And: The server does NOT return HTTP 401 or 403
```
Test type: Integration

**AC-RPT-02 (Failure path — no token)**
```
Given: A request to GET /api/admin/reports
  And: The request carries no JWT cookie and no Authorization header
When: The server receives the request
Then: The server returns HTTP 401
  And: The response body is: { "error": "NO_TOKEN" }  [ASSUMPTION-ADM-15 — confirm exact field name and value]
  And: No database query is executed
  And: The response does not contain any report data
```
Test type: Integration

**AC-RPT-03 (Failure path — expired token)**
```
Given: A request to GET /api/admin/reports
  And: The request carries a JWT whose `exp` claim is in the past
When: The server receives the request
Then: The server returns HTTP 401
  And: The response body is: { "error": "TOKEN_EXPIRED" }  [ASSUMPTION-ADM-15]
  And: No database query is executed
```
Test type: Integration

**AC-RPT-04 (Failure path — malformed token)**
```
Given: A request to GET /api/admin/reports
  And: The request carries a token that is not a valid JWT (e.g., a random string, or JWT with tampered signature)
When: The server receives the request
Then: The server returns HTTP 401
  And: The response body contains an `error` field with a non-empty string value
  And: No database query is executed
```
Test type: Integration

---

### R2, R3 — Paginated list with full PII fields

**AC-RPT-05 (Success path — default pagination)**
```
Given: A valid JWT with role = "admin"
  And: The database contains at least 1 report
  And: The request is GET /api/admin/reports with no query parameters
When: The server responds
Then: HTTP 200 is returned
  And: `data` is an array of report objects
  And: Each report object includes: id, created_at, updated_at, image_path, latitude (exact float64),
       longitude (exact float64), category, severity, description, submitter_name,
       submitter_contact, status, location_source, image_url
  And: `latitude` and `longitude` are NOT rounded — they contain the full stored precision
       (verified by: stored value 12.971619 must appear as 12.971619, not 12.972)
  And: `submitter_contact` is present (may be null if not supplied at submission time)
  And: `submitter_name` is present (may be null if not supplied at submission time)
  And: The results are ordered by `created_at` descending (first element has the most recent timestamp)
  And: `pagination` object contains: { page: 1, limit: <default per ASSUMPTION-ADM-5>,
       total_count: <integer>, total_pages: <integer> }
```
Test type: Integration

**AC-RPT-06 (Success path — explicit pagination)**
```
Given: A valid JWT with role = "admin"
  And: The database contains 45 reports
  And: The request is GET /api/admin/reports?page=2&limit=20
When: The server responds
Then: HTTP 200 is returned
  And: `data` contains exactly 20 reports (reports 21–40 in created_at DESC order)
  And: `pagination.page` = 2
  And: `pagination.limit` = 20
  And: `pagination.total_count` = 45
  And: `pagination.total_pages` = 3
```
Test type: Integration

**AC-RPT-07 (Success path — page beyond last page)**
```
Given: A valid JWT with role = "admin"
  And: The database contains 5 reports
  And: The request is GET /api/admin/reports?page=3&limit=20
When: The server responds
Then: HTTP 200 is returned
  And: `data` is an empty array []
  And: `pagination.total_count` = 5
  And: `pagination.total_pages` = 1
```
Test type: Integration

---

### R4 — PII must not leak through public channels

**AC-RPT-08 (PII isolation)**
```
Given: A response from GET /api/admin/reports
When: The same report ID is fetched via the public endpoint GET /api/reports/:id
Then: The public response does NOT contain `submitter_contact`
  And: The public response does NOT contain `submitter_name`
  And: The public response latitude is rounded to 3 decimal places
     (verified by: stored 12.971619 appears as 12.972 on public endpoint)
  And: The public response longitude is rounded to 3 decimal places
```
Test type: Integration

---

### R5 — Filters

**AC-RPT-09 (Success path — category filter)**
```
Given: A valid JWT with role = "reviewer"
  And: The database contains reports with category = "broken_footpath" and category = "poor_lighting"
  And: The request is GET /api/admin/reports?category=broken_footpath
When: The server responds
Then: HTTP 200 is returned
  And: Every report in `data` has category = "broken_footpath"
  And: No report with category = "poor_lighting" appears in `data`
```
Test type: Integration

**AC-RPT-10 (Success path — status filter)**
```
Given: A valid JWT with role = "reviewer"
  And: The request is GET /api/admin/reports?status=under_review
When: The server responds
Then: HTTP 200 is returned
  And: Every report in `data` has status = "under_review"
```
Test type: Integration

**AC-RPT-11 (Success path — severity filter)**
```
Given: A valid JWT with role = "reviewer"
  And: The request is GET /api/admin/reports?severity=high
When: The server responds
Then: HTTP 200 is returned
  And: Every report in `data` has severity = "high"
```
Test type: Integration

**AC-RPT-12 (Success path — date_from filter)**
```
Given: A valid JWT with role = "admin"
  And: The request is GET /api/admin/reports?date_from=2026-01-01T00:00:00Z
When: The server responds
Then: HTTP 200 is returned
  And: Every report in `data` has created_at >= 2026-01-01T00:00:00Z  [ASSUMPTION-ADM-8 — inclusive]
```
Test type: Integration

**AC-RPT-13 (Success path — date_to filter)**
```
Given: A valid JWT with role = "admin"
  And: The request is GET /api/admin/reports?date_to=2026-02-28T23:59:59Z
When: The server responds
Then: HTTP 200 is returned
  And: Every report in `data` has created_at <= 2026-02-28T23:59:59Z  [ASSUMPTION-ADM-8 — inclusive]
```
Test type: Integration

**AC-RPT-14 (Success path — combined filters)**
```
Given: A valid JWT with role = "admin"
  And: The request is GET /api/admin/reports?category=unsafe_crossing&status=submitted&severity=high
When: The server responds
Then: HTTP 200 is returned
  And: Every report in `data` satisfies ALL three conditions simultaneously
```
Test type: Integration

**AC-RPT-15 (Failure path — invalid category value)**
```
Given: A valid JWT with role = "admin"
  And: The request is GET /api/admin/reports?category=pothole
When: The server responds
Then: HTTP 400 is returned
  And: The response body contains: { "error": "WB-ADM-001", "field": "category",
       "message": <COPY.admin.invalidFilterValue> }
  And: No database query is executed against the reports table
```
Test type: Integration

**AC-RPT-16 (Failure path — invalid status value)**
```
Given: A valid JWT with role = "admin"
  And: The request is GET /api/admin/reports?status=pending
When: The server responds
Then: HTTP 400 is returned
  And: The response body contains: { "error": "WB-ADM-002", "field": "status",
       "message": <COPY.admin.invalidFilterValue> }
```
Test type: Integration

**AC-RPT-17 (Failure path — invalid severity value)**
```
Given: A valid JWT with role = "admin"
  And: The request is GET /api/admin/reports?severity=critical
When: The server responds
Then: HTTP 400 is returned
  And: The response body contains: { "error": "WB-ADM-003", "field": "severity",
       "message": <COPY.admin.invalidFilterValue> }
  Note: "critical" is not in the actual severity_level enum (see SD-2)
```
Test type: Integration

**AC-RPT-18 (Failure path — date_from after date_to)**
```
Given: A valid JWT with role = "admin"
  And: The request is GET /api/admin/reports?date_from=2026-03-01&date_to=2026-01-01
When: The server responds
Then: HTTP 400 is returned  [ASSUMPTION-ADM-7 — Option A]
  And: The response body contains: { "error": "WB-ADM-004",
       "message": <COPY.admin.dateRangeInvalid> }
```
Test type: Integration

**AC-RPT-19 (Failure path — invalid date format)**
```
Given: A valid JWT with role = "admin"
  And: The request is GET /api/admin/reports?date_from=not-a-date
When: The server responds
Then: HTTP 400 is returned
  And: The response body contains: { "error": "WB-ADM-005", "field": "date_from",
       "message": <COPY.admin.invalidDateFormat> }
```
Test type: Integration

**AC-RPT-20 (Failure path — limit exceeds cap)**
```
Given: A valid JWT with role = "admin"
  And: The request is GET /api/admin/reports?limit=999
When: The server responds
Then: HTTP 400 is returned  [ASSUMPTION-ADM-6 — if a cap is set]
  And: The response body contains: { "error": "WB-ADM-006",
       "message": <COPY.admin.limitExceeded> }
  Note: Resolve ASSUMPTION-ADM-6 before implementing. If "no cap" is chosen,
        this AC is vacuously satisfied (the scenario never triggers).
```
Test type: Integration

**AC-RPT-21 (Failure path — page = 0)**
```
Given: A valid JWT with role = "admin"
  And: The request is GET /api/admin/reports?page=0
When: The server responds
Then: HTTP 400 is returned
  And: The response body contains: { "error": "WB-ADM-007", "field": "page",
       "message": <COPY.admin.pageMinOne> }
```
Test type: Integration

---

### R9–R12 — GET /api/admin/reports/:id

**AC-RPT-22 (Success path)**
```
Given: A valid JWT with role = "admin" or "reviewer"
  And: A report with id = "550e8400-e29b-41d4-a716-446655440000" exists in the database
  And: The request is GET /api/admin/reports/550e8400-e29b-41d4-a716-446655440000
When: The server responds
Then: HTTP 200 is returned
  And: The response body is a single report object (not wrapped in `data` array)
  And: The object includes: id, created_at, updated_at, image_path, latitude (exact),
       longitude (exact), category, severity, description, submitter_name,
       submitter_contact, status, location_source, image_url
  And: `latitude` and `longitude` carry the full stored precision (not rounded)
```
Test type: Integration

**AC-RPT-23 (Failure path — report not found)**
```
Given: A valid JWT with role = "admin"
  And: No report exists with id = "00000000-0000-4000-8000-000000000001"
  And: The request is GET /api/admin/reports/00000000-0000-4000-8000-000000000001
When: The server responds
Then: HTTP 404 is returned
  And: The response body is: { "error": "WB-ADM-008", "message": <COPY.admin.reportNotFound> }
```
Test type: Integration

**AC-RPT-24 (Failure path — invalid UUID format)**
```
Given: A valid JWT with role = "admin"
  And: The request is GET /api/admin/reports/not-a-uuid
When: The server responds
Then: HTTP 400 is returned
  And: The response body is: { "error": "WB-ADM-009", "message": <COPY.admin.invalidReportId> }
  And: No database query is executed
```
Test type: Unit

**AC-RPT-25 (Failure path — unauthenticated)**
```
Given: No JWT is present
  And: The request is GET /api/admin/reports/550e8400-e29b-41d4-a716-446655440000
When: The server responds
Then: HTTP 401 is returned
  And: No report data is returned
```
Test type: Integration

---

### R13–R22 — PATCH /api/admin/reports/:id/status

**AC-RPT-26 (Success path — status transition with note)**
```
Given: A valid JWT with role = "admin", claims.sub = "a1b2c3d4-0000-4000-8000-000000000001"
  And: A report with id = "550e8400-e29b-41d4-a716-446655440000" exists with status = "submitted"
  And: The request is PATCH /api/admin/reports/550e8400-e29b-41d4-a716-446655440000/status
  And: Request Content-Type is application/json
  And: Request body is: { "status": "under_review", "note": "Assigned to field team" }
When: The server responds
Then: HTTP 200 is returned
  And: The response body is the updated report object with status = "under_review"
  And: The report's `updated_at` timestamp in the DB is later than it was before the request
  And: A row is inserted into `status_history` with:
         report_id = "550e8400-e29b-41d4-a716-446655440000"
         old_status = "submitted"
         new_status = "under_review"
         note = "Assigned to field team"
         changed_at = (current timestamp, within 5 seconds of request time)
         changed_by = "a1b2c3d4-0000-4000-8000-000000000001"  [pending ASSUMPTION-ADM-1]
  And: No other `status_history` rows are modified
```
Test type: Integration

**AC-RPT-27 (Success path — status transition without note)**
```
Given: A valid JWT with role = "reviewer"
  And: A report exists with status = "under_review"
  And: Request body is: { "status": "resolved" }
When: The server responds
Then: HTTP 200 is returned
  And: `status_history` row inserted with note = null
  And: The response report object has status = "resolved"
```
Test type: Integration

**AC-RPT-28 (Success path — no-op transition)**
```
Given: A valid JWT with role = "admin"
  And: A report exists with status = "resolved"
  And: Request body is: { "status": "resolved" }
When: The server responds
Then: [Per ASSUMPTION-ADM-12 — resolve before implementing]
     Option A: HTTP 200 is returned; a `status_history` row is inserted with old_status = "resolved", new_status = "resolved"
     Option B: HTTP 200 is returned; no new `status_history` row is inserted
     Option C: HTTP 409 Conflict is returned
```
Test type: Integration

**AC-RPT-29 (Failure path — invalid status value)**
```
Given: A valid JWT with role = "admin"
  And: A report exists
  And: Request body is: { "status": "flagged" }
When: The server responds
Then: HTTP 400 is returned
  And: The response body is: { "error": "WB-ADM-010", "field": "status",
       "message": <COPY.admin.invalidStatusValue> }
  And: `reports.status` is NOT modified in the DB
  And: No `status_history` row is inserted
```
Test type: Integration

**AC-RPT-30 (Failure path — missing status field in body)**
```
Given: A valid JWT with role = "admin"
  And: Request body is: { "note": "Some note" }
When: The server responds
Then: HTTP 400 is returned
  And: The response body is: { "error": "WB-ADM-010", "field": "status",
       "message": <COPY.admin.statusRequired> }
```
Test type: Integration

**AC-RPT-31 (Failure path — empty request body)**
```
Given: A valid JWT with role = "admin"
  And: The request body is empty (Content-Length: 0)
When: The server responds
Then: HTTP 400 is returned
  And: The response body contains an `error` field with value "WB-ADM-010"
```
Test type: Integration

**AC-RPT-32 (Failure path — note exceeds max length)**
```
Given: A valid JWT with role = "admin"
  And: A report exists
  And: Request body is: { "status": "resolved", "note": "<string of 2001 characters>" }
When: The server responds
Then: HTTP 400 is returned  [ASSUMPTION-ADM-10 — resolve limit before implementing]
  And: The response body is: { "error": "WB-ADM-011", "field": "note",
       "message": <COPY.admin.noteTooLong> }
  And: `reports.status` is NOT modified
  And: No `status_history` row is inserted
```
Test type: Integration

**AC-RPT-33 (Failure path — report not found)**
```
Given: A valid JWT with role = "admin"
  And: No report exists with the given ID
  And: Request body is: { "status": "resolved" }
When: The server responds
Then: HTTP 404 is returned
  And: The response body is: { "error": "WB-ADM-008", "message": <COPY.admin.reportNotFound> }
  And: No `status_history` row is inserted
```
Test type: Integration

**AC-RPT-34 (Failure path — unauthenticated)**
```
Given: No JWT is present
  And: Request body is: { "status": "resolved" }
When: The server responds
Then: HTTP 401 is returned
  And: No DB writes occur
```
Test type: Integration

**AC-RPT-35 (Failure path — invalid UUID in path)**
```
Given: A valid JWT with role = "admin"
  And: The request path is PATCH /api/admin/reports/not-a-uuid/status
When: The server responds
Then: HTTP 400 is returned
  And: The response body is: { "error": "WB-ADM-009", "message": <COPY.admin.invalidReportId> }
```
Test type: Unit

---

### R23–R30 — DELETE /api/admin/reports/:id

**AC-RPT-36 (Success path — admin role, file exists)**
```
Given: A valid JWT with role = "admin"
  And: A report exists with id = "550e8400-e29b-41d4-a716-446655440000"
  And: The report's image_path = "abc123.jpg"
  And: The file UPLOADS_DIR/abc123.jpg exists on the filesystem
  And: The request is DELETE /api/admin/reports/550e8400-e29b-41d4-a716-446655440000
When: The server responds
Then: HTTP 204 No Content is returned with an empty response body
  And: The report row with the given ID no longer exists in `reports`
  And: All `status_history` rows with report_id = "550e8400-e29b-41d4-a716-446655440000"
       no longer exist (CASCADE confirmed)
  And: The file UPLOADS_DIR/abc123.jpg no longer exists on the filesystem
```
Test type: Integration, E2E

**AC-RPT-37 (Success path — admin role, file missing on filesystem)**
```
Given: A valid JWT with role = "admin"
  And: A report exists with image_path = "missing.jpg"
  And: UPLOADS_DIR/missing.jpg does NOT exist on the filesystem
  And: The request is DELETE /api/admin/reports/<id>
When: The server responds
Then: HTTP 204 No Content is returned  [ASSUMPTION-ADM-9 — Option A]
  And: The report row is deleted from `reports`
  And: A WARNING-level log entry is written containing the report ID and attempted file path
  And: The log entry does NOT propagate as an HTTP 5xx to the client
```
Test type: Integration

**AC-RPT-38 (Success path — admin role, file deletion OS error)**
```
Given: A valid JWT with role = "admin"
  And: A report exists and its image file exists
  And: The filesystem returns a permission-denied error when the file deletion is attempted
When: The server responds
Then: HTTP 204 No Content is returned  [ASSUMPTION-ADM-9 — Option A]
  And: The DB row is deleted
  And: A WARNING-level log entry is written containing "file deletion failed",
       the report ID, the file path, and the OS error message
```
Test type: Integration

**AC-RPT-39 (Failure path — reviewer role)**
```
Given: A valid JWT with role = "reviewer"
  And: A report exists with the given ID
  And: The request is DELETE /api/admin/reports/<id>
When: The server responds
Then: HTTP 403 Forbidden is returned
  And: The response body is: { "error": "WB-ADM-012", "message": <COPY.admin.insufficientRole> }
  And: The report row is NOT deleted from `reports`
  And: The image file is NOT deleted from the filesystem
  And: No `status_history` rows are modified
```
Test type: Integration

**AC-RPT-40 (Failure path — unauthenticated)**
```
Given: No JWT is present
  And: The request is DELETE /api/admin/reports/<id>
When: The server responds
Then: HTTP 401 is returned
  And: No DB reads or writes occur
  And: No file system operations occur
```
Test type: Integration

**AC-RPT-41 (Failure path — report not found, admin role)**
```
Given: A valid JWT with role = "admin"
  And: No report exists with the given ID (valid UUID format)
  And: The request is DELETE /api/admin/reports/00000000-0000-4000-8000-000000000001
When: The server responds
Then: HTTP 404 is returned
  And: The response body is: { "error": "WB-ADM-008", "message": <COPY.admin.reportNotFound> }
  And: No file system operations occur
```
Test type: Integration

**AC-RPT-42 (Failure path — invalid UUID in path)**
```
Given: A valid JWT with role = "admin"
  And: The request path is DELETE /api/admin/reports/not-a-uuid
When: The server responds
Then: HTTP 400 is returned
  And: The response body is: { "error": "WB-ADM-009", "message": <COPY.admin.invalidReportId> }
  And: No DB reads or writes occur
  And: No file system operations occur
```
Test type: Unit

---

### R31–R35 — GET /api/admin/stats

**AC-RPT-43 (Success path — database has reports)**
```
Given: A valid JWT with role = "admin" or "reviewer"
  And: The database contains:
         3 reports with status = "submitted"
         2 reports with status = "under_review"
         1 report with status = "resolved"
         4 reports with category = "broken_footpath"
         2 reports with category = "unsafe_crossing"
  And: The request is GET /api/admin/stats
When: The server responds
Then: HTTP 200 is returned
  And: Response body matches:
       {
         "total_reports": 6,
         "by_status": { "submitted": 3, "under_review": 2, "resolved": 1 },
         "by_category": {
           "no_footpath": 0,
           "broken_footpath": 4,
           "blocked_footpath": 0,
           "unsafe_crossing": 2,
           "poor_lighting": 0,
           "other": 0
         },
         "by_severity": { "low": <N>, "medium": <N>, "high": <N> }
       }
  And: The sum of all `by_status` values equals `total_reports`
  And: The sum of all `by_category` values equals `total_reports`
  And: The sum of all `by_severity` values equals `total_reports`
  Note: Actual `by_severity` values depend on test data — the sums constraint is the testable assertion.
```
Test type: Integration

**AC-RPT-44 (Success path — empty database)**
```
Given: A valid JWT with role = "reviewer"
  And: The `reports` table contains zero rows
  And: The request is GET /api/admin/stats
When: The server responds
Then: [ASSUMPTION-ADM-11 — resolve before implementing]
     Option A: HTTP 200 returned with:
       { "total_reports": 0,
         "by_status": { "submitted": 0, "under_review": 0, "resolved": 0 },
         "by_category": { "no_footpath": 0, "broken_footpath": 0, "blocked_footpath": 0,
                          "unsafe_crossing": 0, "poor_lighting": 0, "other": 0 },
         "by_severity": { "low": 0, "medium": 0, "high": 0 } }
     Option B: HTTP 204 No Content
     Option C: HTTP 200 with all fields null
```
Test type: Integration

**AC-RPT-45 (Failure path — unauthenticated)**
```
Given: No JWT is present
  And: The request is GET /api/admin/stats
When: The server responds
Then: HTTP 401 is returned
  And: No aggregate query is executed
```
Test type: Integration

---

## 4. AC Matrix

| Req ID | AC ID | Scenario Summary | Test Type | Priority | Notes |
|--------|-------|-----------------|-----------|----------|-------|
| R1 | AC-RPT-01 | Valid JWT — list request succeeds | Integration | P0 | Auth gate must be first middleware |
| R1 | AC-RPT-02 | No token — 401, no DB query | Integration | P0 | |
| R1 | AC-RPT-03 | Expired token — 401 TOKEN_EXPIRED | Integration | P0 | ASSUMPTION-ADM-15 blocks message copy |
| R1 | AC-RPT-04 | Malformed token — 401 | Integration | P0 | |
| R2, R3 | AC-RPT-05 | Default pagination, full PII fields returned | Integration | P0 | Verify exact lat/lng precision |
| R6 | AC-RPT-06 | Explicit page=2&limit=20 | Integration | P0 | |
| R6 | AC-RPT-07 | Page beyond last — empty data array | Integration | P1 | |
| R4 | AC-RPT-08 | PII absent from public endpoint response | Integration | P0 | Cross-endpoint isolation |
| R5 | AC-RPT-09 | category filter | Integration | P0 | |
| R5 | AC-RPT-10 | status filter | Integration | P0 | |
| R5 | AC-RPT-11 | severity filter | Integration | P0 | |
| R5 | AC-RPT-12 | date_from filter (inclusive) | Integration | P1 | ASSUMPTION-ADM-8 |
| R5 | AC-RPT-13 | date_to filter (inclusive) | Integration | P1 | ASSUMPTION-ADM-8 |
| R5 | AC-RPT-14 | Combined multi-filter (AND semantics) | Integration | P0 | |
| R8 | AC-RPT-15 | Invalid category value — 400 WB-ADM-001 | Integration | P0 | |
| R8 | AC-RPT-16 | Invalid status value — 400 WB-ADM-002 | Integration | P0 | |
| R8 | AC-RPT-17 | Invalid severity value (critical) — 400 WB-ADM-003 | Integration | P0 | SD-2 discrepancy |
| R8 | AC-RPT-18 | date_from after date_to — 400 WB-ADM-004 | Integration | P1 | ASSUMPTION-ADM-7 |
| R8 | AC-RPT-19 | Invalid date format — 400 WB-ADM-005 | Integration | P1 | |
| R6 | AC-RPT-20 | limit exceeds cap — 400 WB-ADM-006 | Integration | P1 | ASSUMPTION-ADM-6 |
| R6 | AC-RPT-21 | page=0 — 400 WB-ADM-007 | Integration | P1 | |
| R10 | AC-RPT-22 | Get by ID — full detail with exact coords | Integration | P0 | |
| R11 | AC-RPT-23 | Get by ID — not found — 404 WB-ADM-008 | Integration | P0 | |
| R12 | AC-RPT-24 | Get by ID — invalid UUID — 400 WB-ADM-009 | Unit | P0 | No DB hit |
| R9 | AC-RPT-25 | Get by ID — unauthenticated — 401 | Integration | P0 | |
| R16, R17 | AC-RPT-26 | PATCH status with note — 200, history row | Integration | P0 | ASSUMPTION-ADM-1 blocks changed_by |
| R16, R17 | AC-RPT-27 | PATCH status without note — null in history | Integration | P0 | |
| R16 | AC-RPT-28 | PATCH no-op transition | Integration | P2 | ASSUMPTION-ADM-12 |
| R15 | AC-RPT-29 | Invalid status value in PATCH body — 400 | Integration | P0 | No DB write |
| R14 | AC-RPT-30 | Missing status field — 400 | Integration | P0 | |
| R22 | AC-RPT-31 | Empty request body — 400 | Integration | P0 | |
| R21 | AC-RPT-32 | Note exceeds max length — 400 | Integration | P1 | ASSUMPTION-ADM-10 |
| R19 | AC-RPT-33 | PATCH on non-existent report — 404 | Integration | P0 | |
| R13 | AC-RPT-34 | PATCH — unauthenticated — 401 | Integration | P0 | |
| R20 | AC-RPT-35 | PATCH — invalid UUID path — 400 | Unit | P0 | |
| R25, R26, R27 | AC-RPT-36 | DELETE — admin, file exists — 204, cascades | Integration, E2E | P0 | |
| R26 | AC-RPT-37 | DELETE — file missing on filesystem — 204, warn log | Integration | P0 | |
| R26 | AC-RPT-38 | DELETE — file OS error — 204, warn log | Integration | P1 | |
| R24 | AC-RPT-39 | DELETE — reviewer role — 403, no DB write | Integration | P0 | |
| R23 | AC-RPT-40 | DELETE — unauthenticated — 401 | Integration | P0 | |
| R29 | AC-RPT-41 | DELETE — not found — 404 | Integration | P0 | |
| R30 | AC-RPT-42 | DELETE — invalid UUID — 400 | Unit | P0 | |
| R33, R34 | AC-RPT-43 | Stats — database has reports, all keys present | Integration | P0 | |
| R33, R34 | AC-RPT-44 | Stats — empty database | Integration | P1 | ASSUMPTION-ADM-11 |
| R31 | AC-RPT-45 | Stats — unauthenticated — 401 | Integration | P0 | |

---

## 5. Edge Case Matrix

| # | Trigger Condition | Expected System Behavior | User-Facing Message (Copy Placeholder) | Test Type |
|---|-------------------|--------------------------|----------------------------------------|-----------|
| EC-01 | EXIF missing from submitted report (location_source = manual_pin, submitter_contact = null) | GET /api/admin/reports/:id returns the report with `submitter_contact: null` and `location_source: "manual_pin"`; no error | None | Integration |
| EC-02 | Report has no image_path (empty string or null) | DELETE still executes; file deletion step is skipped (no path to delete); WARNING logged; HTTP 204 returned | None | Integration |
| EC-03 | PATCH /status when DB is temporarily unavailable | HTTP 503 returned; response body: `{ "error": "WB-ADM-013", "message": <COPY.admin.serviceUnavailable> }`; no partial write | None to admin — internal tooling; log the error | Integration |
| EC-04 | DELETE called twice on the same report (idempotency) | Second request: report row no longer exists; return HTTP 404 (not 204) | `{ "error": "WB-ADM-008", "message": <COPY.admin.reportNotFound> }` | Integration |
| EC-05 | PATCH /status on a deleted report | HTTP 404 returned; no `status_history` row inserted | `{ "error": "WB-ADM-008", "message": <COPY.admin.reportNotFound> }` | Integration |
| EC-06 | GET /api/admin/reports with limit=0 | HTTP 400 returned with WB-ADM-006 (same as limit exceeding cap) — 0 is not a valid page size | `{ "error": "WB-ADM-006", "message": <COPY.admin.limitMinOne> }` | Integration |
| EC-07 | GET /api/admin/reports with limit=-1 or limit=abc | HTTP 400 returned with WB-ADM-006 | `{ "error": "WB-ADM-006", "message": <COPY.admin.limitMinOne> }` | Unit |
| EC-08 | JWT role claim is an unrecognized value (e.g., role="superuser") | HTTP 403 returned; no data returned | `{ "error": "WB-ADM-014", "message": <COPY.admin.unknownRole> }` | Integration |
| EC-09 | JWT sub claim is not a valid UUID (for PATCH changed_by) | If ASSUMPTION-ADM-1 Option A: application must reject PATCH with HTTP 401 (invalid token shape). If Option B: log the raw string; do not attempt DB write with malformed UUID | `{ "error": "WB-ADM-015", "message": <COPY.admin.malformedToken> }` [Option A] | Integration |
| EC-10 | GET /api/admin/reports with all filters simultaneously (category + status + severity + date_from + date_to + page + limit) | Returns filtered, paginated results satisfying all conditions; no 400 | None | Integration |
| EC-11 | Stats endpoint called while a concurrent PATCH /status is in-flight | Stats query runs as a snapshot read; result reflects either pre- or post-PATCH state (no partial count) | None | Integration |
| EC-12 | Report exists with submitter_contact = "" (empty string, not null) | GET /api/admin/reports returns submitter_contact = "" (preserves stored value, does not coerce to null) | None | Integration |
| EC-13 | Rapid sequential PATCH requests on the same report (race condition) | Last write wins; each PATCH inserts its own `status_history` row; no rows are lost; DB row reflects the final PATCH's status | None | Integration |
| EC-14 | GET /api/admin/reports?page=1&limit=<max cap> on a table with zero rows | Returns HTTP 200 with `data: []`, `pagination.total_count: 0`, `pagination.total_pages: 0` | None | Integration |
| EC-15 | DELETE when UPLOADS_DIR env var is not set or path is misconfigured | File deletion is skipped (no path to construct); WARNING logged with report ID; DB row is deleted; HTTP 204 returned | None to admin; WARNING in server logs | Integration |

---

## 6. Error Codes and User-Facing Messages

New error codes reserved for the Admin domain: WB-ADM-001 through WB-ADM-099.

| Error Code | Trigger Condition | Internal Log Message | User-Facing Message (Copy Placeholder) | Recovery Action Offered |
|------------|------------------|---------------------|----------------------------------------|-------------------------|
| WB-ADM-001 | `category` filter param is not a valid `issue_category` enum value | `[WARN] invalid category filter: <value>` | COPY.admin.invalidFilterValue | List valid values in response body |
| WB-ADM-002 | `status` filter param is not a valid `report_status` enum value | `[WARN] invalid status filter: <value>` | COPY.admin.invalidFilterValue | List valid values in response body |
| WB-ADM-003 | `severity` filter param is not a valid `severity_level` enum value | `[WARN] invalid severity filter: <value>` | COPY.admin.invalidFilterValue | List valid values in response body |
| WB-ADM-004 | `date_from` > `date_to` in query params | `[WARN] date range invalid: from=<v> to=<v>` | COPY.admin.dateRangeInvalid | None |
| WB-ADM-005 | `date_from` or `date_to` is not a parseable ISO 8601 datetime string | `[WARN] unparseable date param: field=<f> value=<v>` | COPY.admin.invalidDateFormat | Provide format hint in response body |
| WB-ADM-006 | `limit` param is <= 0 or exceeds the maximum cap, or is non-numeric | `[WARN] invalid limit param: <value>` | COPY.admin.limitExceeded / COPY.admin.limitMinOne | Valid range stated in response body |
| WB-ADM-007 | `page` param is <= 0 or non-numeric | `[WARN] invalid page param: <value>` | COPY.admin.pageMinOne | None |
| WB-ADM-008 | No report found with the given UUID (GET, PATCH, DELETE) | `[INFO] report not found: id=<uuid>` | COPY.admin.reportNotFound | None |
| WB-ADM-009 | `:id` path parameter is not a valid UUID v4 string | `[WARN] invalid report id param: <value>` | COPY.admin.invalidReportId | None |
| WB-ADM-010 | PATCH body `status` is missing, null, or not one of the three valid enum values | `[WARN] invalid status value in patch body: <value>` | COPY.admin.invalidStatusValue / COPY.admin.statusRequired | List valid values in response body |
| WB-ADM-011 | PATCH body `note` exceeds maximum character length | `[WARN] note too long: len=<n>` | COPY.admin.noteTooLong | State max length in response body |
| WB-ADM-012 | DELETE attempted by a user with role = "reviewer" | `[WARN] delete forbidden: user=<sub> role=reviewer report=<id>` | COPY.admin.insufficientRole | None |
| WB-ADM-013 | DB query fails (connection error, timeout, pool exhaustion) | `[ERROR] db error: <sqlx error message>` | COPY.admin.serviceUnavailable | Retry after delay (no automatic retry on client) |
| WB-ADM-014 | JWT role claim is present but not "admin" or "reviewer" | `[WARN] unknown role in JWT: <value> sub=<sub>` | COPY.admin.unknownRole | Contact system administrator |
| WB-ADM-015 | JWT sub claim is missing or not a valid UUID | `[WARN] malformed JWT sub claim: <value>` | COPY.admin.malformedToken | Re-authenticate |

---

## 7. PII Exposure Assertions

| Data Field | Admin Endpoints | Public Endpoints | Internal Logs | DB Storage | PII Classification (DPDP Act 2023) |
|------------|-----------------|-----------------|---------------|------------|--------------------------------------|
| `id` (UUID) | Returned in full | Returned in full | Logged in WARN/ERROR entries | Stored | No |
| `latitude` (exact) | Returned with full DB precision | Rounded to 3 decimal places (~111 m) | NOT logged in access logs | Stored as exact FLOAT8 | Conditional — see ASSUMPTION-22 |
| `longitude` (exact) | Returned with full DB precision | Rounded to 3 decimal places (~111 m) | NOT logged in access logs | Stored as exact FLOAT8 | Conditional — see ASSUMPTION-22 |
| `submitter_name` | Returned (may be null) | NEVER returned | NEVER logged | Stored | Yes — personal identifier |
| `submitter_contact` | Returned (may be null) | NEVER returned | NEVER logged | Stored | Yes — personal identifier (email/phone) |
| `image_path` | Returned (filename only) | Returned (filename only) | May appear in file-deletion WARNs | Stored | No |
| `image_url` | Returned (full URL) | Returned (full URL) | Not logged | Derived at response time | No |
| `status` | Returned | Returned | Not logged | Stored | No |
| `category`, `severity` | Returned | Returned | Not logged | Stored | No |
| `description` | Returned | Returned | NOT logged | Stored | Potentially — free text may contain PII |
| `location_source` | Returned | Returned | Not logged | Stored | No |
| `created_at`, `updated_at` | Returned | Returned | Not logged | Stored | No |
| `status_history.note` | Accessible via admin tooling (not exposed in any current endpoint) | Never returned | NOT logged | Stored | Potentially — free text may contain PII |
| `status_history.changed_by` | Admin tooling only | Never returned | Logged at INFO on status change | Stored (pending ASSUMPTION-ADM-1) | No (admin user UUID, not citizen data) |
| JWT `sub` claim | Used server-side only | Never exposed | Logged in WARN entries only (never in successful request logs) | Not stored | Yes — admin user identifier |

**Rule: Any server access log that records request paths must NOT include query string parameters** (to prevent `submitter_contact` values from appearing in logs if a future filter is added).

**Rule: The `AdminReport` response struct must be a distinct type from `PublicReport`.** Sharing a single struct with optional-field suppression is not permitted — the two structs must be enforced at the type system level so a future refactor cannot accidentally re-enable PII leakage.

---

## 8. Location Handling Rules (Admin Context)

| Rule | Specification |
|------|---------------|
| Source priority | No new location signals are introduced by admin endpoints. Stored `latitude`, `longitude`, and `location_source` are read-only from the admin layer. |
| Coordinate precision | Admin endpoints return stored `FLOAT8` values without rounding. The stored precision is whatever was submitted by the citizen (typically 6–9 decimal places from device GPS). |
| Public rounding | Enforced in `PublicReport::into_response()` — round to 3 decimal places. Admin `into_response()` must NOT call the rounding function. |
| Location edits | Admin endpoints in this spec do NOT permit editing `latitude`, `longitude`, or `location_source`. If location correction is required, it must be specced as a separate feature. |
| PostGIS `location` column | Read-only by admin endpoints; updated only by the DB trigger on INSERT/UPDATE of lat/lng. Admin endpoints must not set this column directly. |

---

## 9. Data Retention and Privacy Requirements

| Data Element | Public Display Boundary | Internal Use | Retention Period | Deletion Trigger | PII? |
|-------------|------------------------|--------------|-----------------|-----------------|------|
| Report (full row) | Partial (rounded coords, no PII fields) | Admin dashboard, moderation, analytics | ASSUMPTION-9 (unresolved: 12–24 months or indefinite) | Admin DELETE action; or expiry if retention policy chosen | Partially |
| `submitter_name` | Never displayed | Admin review only | Same as report row | Report deletion (CASCADE) | Yes |
| `submitter_contact` | Never displayed | Admin review only | Same as report row | Report deletion (CASCADE) | Yes |
| `latitude` / `longitude` (exact) | Never — public receives rounded | Admin dashboard, PostGIS analysis | Same as report row | Report deletion | Conditional |
| `image_path` / image file | Public URL served (photo visible) | Admin moderation | Same as report row | File deleted on admin DELETE; DB path deleted on row CASCADE | No (but image may contain faces/plates — see ASSUMPTION-21) |
| `status_history` rows | Never | Audit trail | Same as parent report (CASCADE) | Parent report deletion | No (note field may contain PII) |
| Admin JWT (server-side) | Never | Token validation | JWT TTL only (not stored in DB) | JWT expiry | Yes (sub = admin UUID) |
| Server access logs | Never | Ops/debugging | ASSUMPTION-23 (unresolved: 7–90 days) | Log rotation | Potentially (IP addresses) |

---

## 10. Non-Functional Requirements

### Performance
- [ASSUMPTION-NF-1] `GET /api/admin/reports` with all filters applied and `limit=200` must return a response within 2,000 ms on a database with up to 100,000 report rows, measured on a server with 2 vCPUs and 2 GB RAM. Flag as `[ASSUMPTION-NF-1]` if this threshold is not acceptable.
- [ASSUMPTION-NF-2] `GET /api/admin/stats` must return within 3,000 ms on the same database size.
- `PATCH /api/admin/reports/:id/status` must complete (including `status_history` insert) within 1,000 ms under normal DB load.
- `DELETE /api/admin/reports/:id` must complete within 2,000 ms including filesystem operation attempt.

### Availability
- Admin endpoints share the same Axum process as public endpoints. The uptime SLA is governed by ASSUMPTION-24 (unresolved). Degraded-mode behavior: if the DB is unreachable, all admin endpoints return HTTP 503 with error code WB-ADM-013 within 5 seconds (connection timeout must not exceed 5 seconds from request receipt).

### Security
- All admin endpoints must be inaccessible without a valid JWT. There must be no route that bypasses authentication for any `/api/admin/*` path.
- Rate limiting for admin endpoints: [ASSUMPTION-NF-3] Apply a separate rate limit of 60 requests/minute per authenticated admin user (identified by JWT `sub`). If this conflicts with the existing nginx-level POST rate limit (5 r/m), nginx config must be updated to exempt `/api/admin/*` from the public POST rate limit. Confirm with infrastructure team.
- CORS: `/api/admin/*` endpoints must only be accessible from the admin dashboard origin. [ASSUMPTION-NF-4] Admin dashboard origin is a distinct value from `CORS_ORIGIN` (which serves the public frontend). Confirm whether a separate `ADMIN_CORS_ORIGIN` env var is needed.

### Accessibility
- Admin dashboard is an internal operator tool. [ASSUMPTION-NF-5] Minimum accessibility requirement is WCAG 2.1 AA for keyboard navigation and screen reader compatibility. This covers the frontend `/admin` UI, not the API endpoints.

### Localization
- Admin dashboard user-facing messages: [ASSUMPTION-NF-6] English only for the initial release. No Kannada translation required for internal operator tooling. Confirm if this decision changes.

---

## 11. API Behavioral Expectations

### Request Contract (all admin endpoints)

| Aspect | Specification |
|--------|---------------|
| Authentication input | JWT delivered via HttpOnly cookie OR `Authorization: Bearer <token>` header [ASSUMPTION-ADM-2] |
| Content-Type for PATCH | Must be `application/json`; if `Content-Type` is absent or wrong, return HTTP 415 Unsupported Media Type |
| UUID format | All `:id` params must be lowercase hyphenated UUID v4 (e.g., `550e8400-e29b-41d4-a716-446655440000`); uppercase accepted [ASSUMPTION-NF-7: confirm case sensitivity] |
| Date format | `date_from` and `date_to` must be ISO 8601 (e.g., `2026-01-01T00:00:00Z` or `2026-01-01`); timezone offset accepted |

### Response Contract

| Endpoint | Success Status | Success Body Shape |
|----------|---------------|--------------------|
| GET /api/admin/reports | 200 | `{ data: AdminReport[], pagination: { page, limit, total_count, total_pages } }` |
| GET /api/admin/reports/:id | 200 | `AdminReport` (single object, not array) |
| PATCH /api/admin/reports/:id/status | 200 | `AdminReport` (updated report) |
| DELETE /api/admin/reports/:id | 204 | Empty body |
| GET /api/admin/stats | 200 | `{ total_reports, by_status, by_category, by_severity }` |

### Idempotency

| Endpoint | Idempotent? | Behavior on repeat call |
|----------|-------------|------------------------|
| GET /api/admin/reports | Yes | Returns current DB state each time |
| GET /api/admin/reports/:id | Yes | Returns current state or 404 if deleted |
| PATCH /api/admin/reports/:id/status | No — each call may insert a `status_history` row | See ASSUMPTION-ADM-12 for no-op transition behavior |
| DELETE /api/admin/reports/:id | No — second call returns 404 | See AC-RPT-04 (edge case EC-04) |
| GET /api/admin/stats | Yes | Returns current aggregate state |

### Timeout and Retry
- Server must respond within 30 seconds for all endpoints (matching existing nginx proxy read timeout).
- If the server does not respond within 30 seconds, nginx returns 504 Gateway Timeout to the client.
- The admin dashboard client must display a timeout error after 30 seconds and offer a manual retry button. No automatic retry.

### Rate Limiting
- [ASSUMPTION-NF-3] Admin-specific rate limit: 60 req/min per authenticated user. When exceeded: HTTP 429 with `Retry-After` header set to the number of seconds until the rate limit window resets.

---

## Handoff Checklist

```
[x] Each requirement (R1-R35) has at least one success AC and one failure AC
[x] Each AC is mapped to at least one test type in the AC matrix
[x] All edge cases from the standard list have been addressed:
    - EXIF missing: EC-01
    - Wrong GPS / WhatsApp-stripped: Not applicable to admin read/update/delete endpoints
      (location data is already stored; admin does not re-submit photos)
    - Spoofed location: Not applicable (admin cannot edit lat/lng in this spec)
    - Duplicate submissions: Not applicable (admin read/triage layer, not submission)
    - Large files: Not applicable (admin does not upload files in this spec)
    - Slow/interrupted networks: Covered by 30s timeout + 503 (EC-03)
    - Batch/rapid submissions: EC-13 (rapid PATCH), ASSUMPTION-NF-3 (rate limit)
    - Invalid file types: Not applicable (admin does not upload in this spec)
    - Boundary coordinates: Not applicable (admin reads stored coords; no new coordinate validation)
[x] Error codes and user-facing messages defined for all failure paths (WB-ADM-001 to WB-ADM-015)
[x] Privacy/public-display boundaries specified for each data element (Section 7 and 9)
[x] Location handling rules specified (Section 8)
[x] All assumptions labeled [ASSUMPTION-ADM-n] with 2-3 decision options
[x] No implementation details present in any AC
[x] No hand-wavy language present in any AC

ITEMS REQUIRING PRODUCT TEAM RESOLUTION BEFORE HANDOFF TO TDD:
[ ] ASSUMPTION-ADM-1: Does 002_admin.sql exist / will it be created? (blocks R17, AC-RPT-26, EC-09)
[ ] ASSUMPTION-ADM-2: JWT delivery mechanism — cookie vs header? (blocks all auth ACs)
[ ] ASSUMPTION-ADM-3: JWT claims shape (blocks R17 changed_by, EC-09)
[ ] ASSUMPTION-ADM-5: Default limit for admin list endpoint
[ ] ASSUMPTION-ADM-6: Maximum limit cap
[ ] ASSUMPTION-ADM-7: date_from > date_to behavior (400 vs 200 empty)
[ ] ASSUMPTION-ADM-8: date range bounds inclusive/exclusive
[ ] ASSUMPTION-ADM-9: File deletion failure response (204 vs 207 vs 500) — blocks AC-RPT-37, AC-RPT-38
[ ] ASSUMPTION-ADM-10: max note length — blocks AC-RPT-32, R21
[ ] ASSUMPTION-ADM-11: Empty DB stats response shape — blocks AC-RPT-44
[ ] ASSUMPTION-ADM-12: No-op PATCH transition behavior — blocks AC-RPT-28
[ ] ASSUMPTION-ADM-15: Distinct 401 body for expired vs missing token
[ ] SD-4: Confirm that 002_admin.sql (admin_users table + status_history.changed_by column) is in scope for this feature
[ ] ASSUMPTION-NF-3: Admin rate limit value and nginx exemption
```

---

*Document ends. Next step: product team resolves blocking assumptions, then this document is handed to the tdd-test-author agent for test suite authorship.*
