# Codebase Concerns

**Analysis Date:** 2026-03-11

---

## Tech Debt

**Stale TODO comments in implemented code (misleading):**
- Issue: `backend/src/models/admin.rs` and `backend/src/handlers/admin.rs` contain ~10 "TODO: implement — replace todo!() with:" doc-comment blocks that were written as TDD red-phase stubs. The functions they annotate ARE fully implemented now, but the TODO comments were never cleaned up. They create false impression that functions are stubs.
- Files: `backend/src/models/admin.rs` (lines 84, 188, 250, 272, 299, 363, 402, 431, 449), `backend/src/handlers/admin.rs` (lines 115, 145, 187)
- Impact: Misleads future engineers about implementation status; degrades signal-to-noise ratio of the codebase.
- Fix approach: Remove the "TODO: implement — replace todo!() with:" doc sections from all functions that are fully implemented; keep only the behavioral contract docs.

**Admin list_reports response shape mismatch between backend and frontend type contract:**
- Issue: The backend `admin_list_reports` handler (`backend/src/handlers/admin.rs:418`) returns `{"page", "limit", "count", "items": [...]}`. The frontend `AdminReportListResponse` type in `frontend/app/admin/lib/adminApi.ts:52–60` declares `{data: AdminReport[], pagination: {page, limit, total_count, total_pages}}`. The admin reports page (`frontend/app/admin/reports/page.tsx:63`) calls `res.data`, which will be `undefined` at runtime because the backend sends `items` not `data`, and there is no `pagination` wrapper or `total_count`.
- Files: `backend/src/handlers/admin.rs` (line 418–423), `frontend/app/admin/lib/adminApi.ts` (lines 52–60), `frontend/app/admin/reports/page.tsx` (line 63)
- Impact: The admin reports page renders an empty table in production even when reports exist. This is a silent functional bug that tests may not catch if test fixtures inject data via `res.data` mock.
- Fix approach: Align backend response to emit `{data: [...], pagination: {page, limit, total_count, total_pages}}` with a COUNT(*) query, OR update the frontend type and page to use `res.items` and `res.count`.

**Admin report JSON missing `image_url` and `updated_at` fields:**
- Issue: `backend/src/db/admin_queries.rs:234–288` (`list_admin_reports`) and `:297–336` (`get_admin_report_by_id`) build JSON via `serde_json::json!` and do NOT include `image_url` (computed from `api_base_url`) or `updated_at` columns. However, the frontend `AdminReport` interface requires both (`frontend/app/admin/lib/adminApi.ts:38,40`).
- Files: `backend/src/db/admin_queries.rs` (lines 270–286, 320–334)
- Impact: `image_url` will be `undefined` in admin report popups and the reports table; `updated_at` will be missing. Silent data gap rather than a hard crash.
- Fix approach: Add `updated_at` to the SELECT and include it in the JSON. Thread `api_base_url` through `list_admin_reports` and `get_admin_report_by_id` to compute `image_url`.

**`props as any` type escape hatch in admin page components:**
- Issue: `frontend/app/admin/reports/page.tsx:20` and `frontend/app/admin/users/page.tsx:14` use `(props as any).role` and `(props as any).currentUserId` to inject test-only data via a mechanism that bypasses TypeScript. This pattern exists because the test author needed to inject state without refactoring the component.
- Files: `frontend/app/admin/reports/page.tsx` (line 20), `frontend/app/admin/users/page.tsx` (line 14)
- Impact: TypeScript type safety is lost for those props; if the test injection pattern ever diverges from the component signature a runtime error occurs instead of a compile-time error.
- Fix approach: Pass test data via a dedicated optional prop typed correctly, or use a React context/provider pattern in tests.

**Public report list has no total count — pagination is blind:**
- Issue: `backend/src/handlers/reports.rs:174–179` returns `{"page", "limit", "count": items.len(), "items": [...]}` where `count` is the number of items on the current page, not the total across all pages. There is no `total_count` or `total_pages`. The public map fetches `?limit=200` and stops, silently dropping reports once the DB exceeds 200 rows.
- Files: `backend/src/handlers/reports.rs` (lines 153–179), `frontend/app/components/ReportsMap.tsx` (line 64)
- Impact: When the database holds more than 200 reports (a realistic threshold for a live civic app), the public map will silently show only the 200 most-recent reports with no indication of truncation.
- Fix approach: Add a `COUNT(*)` to the list query and expose `total_count`/`total_pages` in the response, or implement marker clustering with a spatial bounding-box filter so the map only fetches visible reports.

---

## Known Bugs

**Two permanently broken tests in `reports/map/__tests__/page.test.tsx`:**
- Symptoms: Two tests call `toHaveBeenCalledWith(message, secondArg)` where `secondArg` is a documentation string; Jest interprets this as expecting a second call argument that never exists.
- Files: `frontend/app/admin/reports/map/__tests__/page.test.tsx`
- Trigger: Running `cd frontend && npm test` — these 2 of 566 tests always fail.
- Workaround: Documented as permanently unfixable test-author bugs in project MEMORY.md. The behavioral contract is preserved; only the assertion syntax is wrong. Tests must not be modified per project rules.

**`admin_list_reports` pagination total_count is absent — frontend pagination UI non-functional:**
- Symptoms: `ReportsTable` in the admin dashboard cannot compute total pages because `total_count` is not in the backend response; any "next page" UI would never enable.
- Files: `frontend/app/admin/components/ReportsTable.tsx`, `backend/src/handlers/admin.rs` (line 418–423)
- Trigger: Navigating to `/admin/reports` with more than 20 reports in the database.
- Workaround: None at runtime. The table shows page 1 only.

---

## Security Considerations

**`COOKIE_SECURE` defaults to `false` in production docker-compose:**
- Risk: The admin `admin_token` JWT cookie is transmitted over plain HTTP in any deployment that does not explicitly set `COOKIE_SECURE=true`. An HTTP-only deployment (without TLS) is therefore susceptible to cookie theft via network interception.
- Files: `docker-compose.yml` (line 41), `backend/src/handlers/admin.rs` (lines 335–347)
- Current mitigation: `SameSite=Strict` is set, which prevents cross-site request forgery. The `COOKIE_SECURE` env var is documented; the security audit notes it requires TLS at nginx.
- Recommendations: Add a deploy-time check or ops runbook step that fails loudly if `COOKIE_SECURE` is not `true` on any publicly accessible deployment. Consider defaulting to `true` and requiring explicit `COOKIE_SECURE=false` opt-out for local dev.

**`submitter_name` exposed in public unauthenticated API (FINDING-012 — deferred):**
- Risk: `GET /api/reports` and `GET /api/reports/:id` include `submitter_name` in the response. This field contains user-entered PII with no consent mechanism for public display.
- Files: `backend/src/models/report.rs` (lines 37, 54)
- Current mitigation: `submitter_contact` is correctly excluded. The security audit acknowledges this as an open product decision (deferred P2).
- Recommendations: Either (a) require explicit opt-in consent during submission before the name is persisted, or (b) strip `submitter_name` from public responses and reserve it for admin-only endpoints.

**Login page surfaces `body.message` from server error responses (FINDING-010 — deferred):**
- Risk: An error response body from the backend is shown directly to the user (`body.error ?? body.message ?? "Unexpected error..."`). If server error messages ever include stack traces or internal details they would be surfaced to unauthenticated users.
- Files: `frontend/app/admin/login/page.tsx` (lines 64–87)
- Current mitigation: Fallback to generic messages for 401, 429, and 5xx. Only the catch-all branch exposes `body.error ?? body.message`. Assessed low impact because current backend error messages are safe strings.
- Recommendations: Strip the `body.message` fallback from the catch-all branch; use only the per-status generic messages.

**Password validation gap between client and server (PHASE2-001 — known gap):**
- Risk: Client-side password validation uses threshold `< 8` characters; server-side validation uses `< 12`. An 8–11 character password passes the browser but is rejected by the server with a generic error, creating a confusing UX and theoretically allowing 8–11 char passwords through if the server validation is bypassed.
- Files: `frontend/app/admin/profile/page.tsx` (client validation), `backend/src/handlers/admin.rs` (line 166: `password.chars().count() < 12`)
- Current mitigation: Server always enforces the 12-char minimum; the gap is purely UX, not security. Documented in PHASE2-001.
- Recommendations: Align client threshold to `< 12` to match server contract.

**No TLS/HTTPS in nginx configuration:**
- Risk: The `nginx/nginx.conf` only configures `listen 80`. There is no HTTPS listener, no SSL certificate mount, and no HTTP→HTTPS redirect. In a production deployment without a TLS-terminating reverse proxy in front of nginx, all traffic (including the admin JWT cookie) travels in plaintext.
- Files: `nginx/nginx.conf`
- Current mitigation: Deployment is expected to sit behind a TLS-terminating load balancer or CDN. This is not documented in the nginx config itself.
- Recommendations: Add a commented HTTPS block with Let's Encrypt instructions, or document the expected TLS termination layer explicitly in the runbook.

**No rate limiting on public `POST /api/reports` report submission beyond nginx 5r/m:**
- Risk: The nginx rate limit (`upload` zone: 5 req/min per IP) is the only protection against bulk fake report submission. An attacker rotating IPs or submitting near the rate limit can flood the database with fabricated reports. There is no CAPTCHA, no per-user submission cap, and no server-side content deduplication.
- Files: `nginx/nginx.conf` (line 7), `backend/src/handlers/reports.rs`
- Current mitigation: 5 requests/minute per IP, burst=2. Bounding-box validation prevents reports outside Bengaluru.
- Recommendations: Add image hash deduplication at the DB level; consider a honeypot or time-delay mechanism at the form level; document the spam risk in the product backlog.

---

## Performance Bottlenecks

**Public map fetches all 200 reports on every tab focus (visibility change):**
- Problem: `frontend/app/components/ReportsMap.tsx` re-fetches `GET /api/reports?limit=200` on every `visibilitychange` event (tab becoming visible). For mobile users with slow connections who frequently switch apps, this triggers repeated large fetches.
- Files: `frontend/app/components/ReportsMap.tsx` (lines 74–80)
- Cause: The visibility listener calls `fetchReports()` unconditionally with no debounce or staleness check.
- Improvement path: Add a minimum refetch interval (e.g. 5 minutes since last fetch) before re-fetching on visibility change, or use a SWR/React Query approach with cache invalidation.

**Leaflet icon assets fetched from unpkg CDN on every map render:**
- Problem: Both `frontend/app/components/LocationMap.tsx` (lines 103–107) and `frontend/app/components/ReportsMap.tsx` (lines 57–61) fetch Leaflet marker icon images from `https://unpkg.com/leaflet@1.9.4/...` at runtime. This introduces a hard dependency on an external CDN for correct map icon rendering.
- Files: `frontend/app/components/LocationMap.tsx` (lines 103–107), `frontend/app/components/ReportsMap.tsx` (lines 57–61)
- Cause: Leaflet default icon fix for Next.js/webpack environment requires overriding the icon URLs; CDN URLs were used as the quickest fix.
- Improvement path: Copy the three icon assets into `frontend/public/leaflet/` and reference them as `/leaflet/marker-icon.png` etc. to eliminate the external CDN dependency.

**`list_admin_reports` builds a dynamic SQL string with string formatting:**
- Problem: `backend/src/db/admin_queries.rs:234–255` constructs a SQL query by manually formatting a WHERE clause string with positional parameter indices. While values are still bound via parameterized binds (no SQL injection risk), the approach is fragile — reordering conditions or adding new filters requires careful index tracking.
- Files: `backend/src/db/admin_queries.rs` (lines 188–288)
- Cause: SQLx compile-time macros cannot be used without a live DB; dynamic filtering was implemented manually.
- Improvement path: Use `sqlx::QueryBuilder` which handles positional parameter tracking automatically and is less error-prone when adding new filter conditions.

**Argon2id hashing on every failed login even for non-existent users:**
- Problem: `backend/src/handlers/admin.rs:285–298` always runs Argon2id verification against either the real or a `DUMMY_HASH` constant. This is correct for timing-attack prevention, but Argon2id is intentionally slow (~100–200ms). Under a login spray attack, every request consumes significant CPU time.
- Files: `backend/src/handlers/admin.rs` (lines 267–358)
- Cause: This is a correct timing-safe implementation; the performance cost is a deliberate security trade-off.
- Improvement path: The nginx rate limit (5r/m on the login endpoint) is the primary mitigation. If CPU pressure appears under sustained attack, consider adding a circuit-breaker at the nginx layer (e.g. temporary IP ban after N failures via `fail2ban`).

---

## Fragile Areas

**`require_role` in `handlers/admin.rs` vs `middleware/auth.rs` — two implementations with different semantics:**
- Files: `backend/src/handlers/admin.rs` (line 194–199), `backend/src/middleware/auth.rs` (line 82–91)
- Why fragile: There are two functions named `require_role`. The one in `middleware/auth.rs` correctly implements "admin is a superset of all roles" (`if claims.role == "admin" { return Ok(()) }`). The one in `handlers/admin.rs` uses strict equality only (`if claims.role == required_role`). If a handler accidentally uses the wrong import, role gating silently breaks — an admin user would be rejected from reviewer-gated endpoints.
- Safe modification: Always import `require_role` from `crate::middleware::auth`, never from `crate::handlers::admin`.
- Test coverage: The middleware version has unit tests; the handler version's tests also use strict equality (consistent with its own contract) but the divergence itself is untested.

**Admin layout relies on `x-pathname` header set by edge middleware:**
- Files: `frontend/app/admin/layout.tsx` (line 10), `frontend/middleware.ts`
- Why fragile: `AdminLayout` reads `headers().get('x-pathname')` to detect the login page and skip auth. If the edge middleware is disabled, misconfigured, or not deployed (e.g. `next start` without the middleware running), the header is absent and `pathname` defaults to `''`. The login page check `pathname.startsWith('/admin/login')` then silently fails, causing an infinite redirect loop at `/admin/login`.
- Safe modification: Do not remove or rename the `x-pathname` header injection in `frontend/middleware.ts`. When testing auth flows, always exercise the full middleware stack.
- Test coverage: Middleware has 29 unit tests but they test the middleware in isolation; the layout's dependency on the header is tested separately and not in an integration scenario.

**Image storage on a Docker named volume with no backup strategy:**
- Files: `docker-compose.yml` (line 44: `- uploads:/app/uploads`)
- Why fragile: All uploaded photos live in a Docker named volume. There is no backup job, no S3 sync, and no retention policy. A `docker compose down -v` or host disk failure permanently loses all submitted photos.
- Safe modification: Never run `docker compose down -v` on a production host. Before any infrastructure change, snapshot the volume.
- Test coverage: Not tested; the volume is a deployment concern.

**`serde_json::to_value(...).unwrap()` in production handler paths:**
- Files: `backend/src/handlers/admin.rs` (lines 390, 553)
- Why fragile: `admin_me` and `admin_get_stats` call `.unwrap()` on JSON serialization. While the types being serialized (`AdminUserResponse`, `StatsResponse`) are simple structs that should never fail serialization, a future change adding a non-serializable type (e.g. a raw `Bytes` field) would cause a runtime panic with no graceful HTTP error response.
- Safe modification: Replace `.unwrap()` with `.map_err(|e| AppError::Internal(e.to_string()))?` for both calls.
- Test coverage: Not directly tested for the panic path.

---

## Scaling Limits

**Local filesystem image storage:**
- Current capacity: Bounded by the Docker host's disk. The `uploads` volume has no size limit set in `docker-compose.yml`.
- Limit: A single host running out of disk silently breaks all new report submissions (Rust `tokio::fs::write` returns an IO error → HTTP 500).
- Scaling path: The code comments acknowledge this ("Abstraction-ready for S3 swap" in CLAUDE.md). The `uploads_dir` string in `AppState` is the only coupling point. Swapping to S3/R2 requires replacing `ServeDir` with a signed-URL redirect handler and `tokio::fs::write` with an S3 `put_object` call.

**PostGIS geography queries without connection pool tuning for concurrent load:**
- Current capacity: `max_connections(10)` is set in `PgPoolOptions` (`backend/src/main.rs:81`). PostgreSQL default `max_connections` is 100; the backend uses 10.
- Limit: Under concurrent load (e.g. media coverage spike with many simultaneous submissions), all 10 connections can be saturated; new requests queue and eventually time out.
- Scaling path: Increase `max_connections` on both the pool and PostgreSQL. For higher throughput, add PgBouncer as a connection pooler in front of PostgreSQL.

**No read replica or query caching for the public map endpoint:**
- Current capacity: Every public map page load triggers `SELECT ... FROM reports ORDER BY created_at DESC LIMIT 200` directly against the primary.
- Limit: At a few dozen concurrent users the public map generates significant read load on the same DB instance that handles writes.
- Scaling path: Add a short TTL cache (Redis or in-memory) for the read-heavy `list_reports` query; alternatively add a PostGIS read replica.

---

## Dependencies at Risk

**`exifr` loaded via `require()` rather than `import` for Jest interop:**
- Risk: `frontend/app/components/PhotoCapture.tsx` loads exifr via `const exifr = require("exifr").default` (documented in MEMORY.md). This bypasses the normal ESM import path and is fragile if `exifr` changes its module export shape in a future version.
- Impact: EXIF GPS extraction silently returns `null` on any exifr API change, causing all photos to default to manual pin location.
- Migration plan: Once the Jest/ESM interop situation improves (Next.js ESM test support), convert to a standard `import` and update the mock.

**Leaflet 1.9.4 pinned via CDN URL — not in package.json devDependencies:**
- Risk: The Leaflet icon URLs are hardcoded to `https://unpkg.com/leaflet@1.9.4/...`. The package itself is a `react-leaflet` peer dependency. If unpkg has an outage or the `leaflet@1.9.4` package is yanked from npm (rare but possible), map markers disappear.
- Impact: Map renders without icons; users can still see `CircleMarker`s which have no icon dependency.
- Migration plan: Copy icon assets to `frontend/public/leaflet/` and reference locally.

---

## Missing Critical Features

**No HTTPS configuration in nginx:**
- Problem: `nginx/nginx.conf` has no TLS listener. Production deployments require HTTPS for cookie security, but there is no nginx SSL configuration, no certificate management setup, and no HTTP→HTTPS redirect.
- Blocks: `COOKIE_SECURE=true` requires TLS; without it the admin cookie is sent in plaintext.

**No admin pagination UI — only first page of reports is accessible:**
- Problem: The admin reports table fetches page 1 with limit 20, but there is no "next page" button and `total_count`/`total_pages` are not returned by the backend. As the database grows beyond 20 reports, older reports become inaccessible from the admin dashboard.
- Blocks: Admin ability to review and triage all submitted reports.

**No image deduplication or spam protection beyond IP rate limiting:**
- Problem: Any actor with a rotating IP can flood the system with fabricated reports at 5 per minute per IP indefinitely. There is no report content deduplication, no CAPTCHA, and no account requirement.
- Blocks: Data quality at scale.

**No backup or disaster recovery plan for image uploads volume:**
- Problem: The `uploads` Docker volume has no automated backup. Loss of the host or accidental `docker compose down -v` permanently destroys all uploaded photos.
- Blocks: Data recovery after infrastructure failure.

---

## Test Coverage Gaps

**No integration tests requiring a live database:**
- What's not tested: All backend tests run without a DB (SQLx runtime API, no live DB per MEMORY.md). Actual SQL query correctness — correct column names, correct JOIN behavior, correct enum casting — is not verified in CI.
- Files: `backend/tests/` directory, `backend/src/` (all `#[cfg(test)]` modules)
- Risk: A typo in a column name or an incorrect `::TEXT` cast in `list_admin_reports` would compile cleanly and only fail at runtime with a 500 error.
- Priority: High

**No E2E tests for the full submission flow:**
- What's not tested: The multi-step report wizard (`frontend/app/report/page.tsx`) is covered by Jest/jsdom unit tests, but no E2E test (Playwright, Cypress) validates the complete flow: photo upload → EXIF extraction → map pin → form submit → backend persist → success screen.
- Files: `frontend/app/report/page.tsx`, `frontend/app/components/PhotoCapture.tsx`
- Risk: Integration failures between frontend compression, multipart upload, and backend EXIF stripping are invisible in the current test suite.
- Priority: High

**No test for the Leaflet icon fix side-effect in `ReportsMap` and `LocationMap`:**
- What's not tested: The `delete L.Icon.Default.prototype._getIconUrl` + `mergeOptions` pattern inside `fetchReports` is executed inside a `useCallback` hook. Tests mock `react-leaflet` globally, so the actual Leaflet mutation path is never exercised.
- Files: `frontend/app/components/ReportsMap.tsx` (lines 52–62), `frontend/app/components/LocationMap.tsx` (lines 97–108)
- Risk: If Leaflet's internal API changes, the workaround silently stops working and markers break in production with no test regression.
- Priority: Low

**Admin reports map page has 2 permanently failing tests:**
- What's not tested: The 2 broken test assertions (see Known Bugs above) cover behaviors that are otherwise exercised but with incorrect `toHaveBeenCalledWith` argument structure.
- Files: `frontend/app/admin/reports/map/__tests__/page.test.tsx`
- Risk: Low — the behavioral contract is met; only the assertion syntax is broken. But CI shows 2 failing tests permanently, which risks normalizing test failures.
- Priority: Low

---

*Concerns audit: 2026-03-11*
