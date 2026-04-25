# Codebase Concerns

**Original audit:** 2026-03-11
**Last updated:** 2026-04-25 — restructured into Open / Resolved / Accepted Risks / Stale after Phase 02.1–02.3.1 completion

---

## Open Concerns

Concerns that remain unresolved and require future attention.

---

### Tech Debt

**Stale TODO comments in implemented code (misleading):**
- Issue: `backend/src/models/admin.rs` and `backend/src/handlers/admin.rs` contain ~10 "TODO: implement — replace todo!() with:" doc-comment blocks that were written as TDD red-phase stubs. The functions ARE fully implemented; the TODO comments were never cleaned up.
- Files: `backend/src/models/admin.rs` (lines 84, 188, 250, 272, 299, 363, 402, 431, 449), `backend/src/handlers/admin.rs` (lines 115, 145, 187)
- Impact: Misleads future engineers about implementation status.
- Fix: Remove the stub doc-comment sections from all fully-implemented functions.

**`props as any` type escape hatch in admin page components:**
- Issue: `frontend/app/admin/reports/page.tsx:20` and `frontend/app/admin/users/page.tsx:14` use `(props as any).role` and `(props as any).currentUserId` to inject test-only data.
- Files: `frontend/app/admin/reports/page.tsx` (line 20), `frontend/app/admin/users/page.tsx` (line 14)
- Impact: TypeScript type safety bypassed; runtime errors instead of compile-time errors if injection pattern diverges.
- Fix: Pass test data via a correctly-typed optional prop or React context/provider pattern.

---

### Known Bugs

**No admin pagination UI — backend returns total_count but frontend has no "next page" control:**
- Symptoms: Backend `list_admin_reports` returns `total_count` and `total_pages` (fixed in Phase 01-04), but the admin reports page has no pagination buttons. Reports beyond page 1 are inaccessible from the admin dashboard.
- Files: `frontend/app/admin/reports/page.tsx`, `frontend/app/admin/components/ReportsTable.tsx`
- Workaround: None at runtime. Only page 1 (20 reports) is accessible via the UI.

---

### Security

**No TLS/HTTPS in nginx configuration:**
- Risk: `nginx/nginx.conf` only configures `listen 80`. In a Docker Compose self-hosted deployment without a TLS-terminating reverse proxy in front, all traffic travels in plaintext.
- Files: `nginx/nginx.conf`
- Current mitigation: Staging deployment sits behind Vercel (frontend) and Railway (backend), both of which provide TLS termination. The nginx config is used for local dev and self-hosted Docker Compose deployments only.
- Recommendation: Add a commented HTTPS block with Let's Encrypt instructions, or document TLS termination assumptions at the top of nginx.conf.

---

### Performance

**Public map re-fetches all reports on every tab focus (no debounce):**
- Problem: `frontend/app/components/ReportsMap.tsx` re-fetches `GET /api/reports` on every `visibilitychange` event with no debounce or staleness check.
- Files: `frontend/app/components/ReportsMap.tsx` (visibility listener)
- Impact: Repeated large fetches for mobile users who frequently switch apps.
- Fix: Add a minimum refetch interval (e.g. 5 minutes since last fetch) or use SWR/React Query with cache invalidation.

**Leaflet icon assets fetched from unpkg CDN on every map render:**
- Problem: Both `LocationMap.tsx` and `ReportsMap.tsx` reference Leaflet marker icons from `https://unpkg.com/leaflet@1.9.4/...` at runtime. Hard dependency on external CDN.
- Files: `frontend/app/components/LocationMap.tsx`, `frontend/app/components/ReportsMap.tsx`
- Fix: Copy icon assets to `frontend/public/leaflet/` and reference locally.

**`list_admin_reports` builds dynamic SQL with string formatting:**
- Problem: `backend/src/db/admin_queries.rs` constructs WHERE clause strings with positional parameter indices manually. Fragile when adding new filters.
- Files: `backend/src/db/admin_queries.rs`
- Fix: Use `sqlx::QueryBuilder` which handles positional parameter tracking automatically.

---

### Fragile Areas

**Admin layout relies on `x-pathname` header set by edge middleware:**
- Files: `frontend/app/admin/layout.tsx`, `frontend/middleware.ts`
- Why fragile: If edge middleware is disabled or misconfigured, the `x-pathname` header is absent and `pathname` defaults to `''`, causing an infinite redirect loop at `/admin/login`.
- Safe modification: Never remove or rename the `x-pathname` header injection in `frontend/middleware.ts`.

**`exifr` loaded via `require()` rather than `import` for Jest interop:**
- Risk: `frontend/app/components/PhotoCapture.tsx` loads exifr via `const exifr = require("exifr").default`. Fragile if exifr changes its module export shape in a future version — EXIF extraction silently returns `null`.
- Migration: Convert to standard `import` once Next.js ESM test support improves.

---

### Scaling Limits

**Local filesystem image storage (self-hosted deployment only):**
- Current capacity: Bounded by the Docker host disk. No size limit set in `docker-compose.yml`.
- Limit: Host disk full → `tokio::fs::write` returns IO error → HTTP 500 on all new submissions.
- Scaling path: `uploads_dir` in `AppState` is the only coupling point. Swap to S3/R2 by replacing `ServeDir` with a signed-URL redirect handler.

**PostGIS connection pool capped at 10:**
- Current capacity: `max_connections(10)` in `PgPoolOptions`. Under concurrent load, all 10 connections can be saturated.
- Scaling path: Increase pool size; add PgBouncer for higher throughput.

**No read replica or query caching for public map:**
- Limit: Every public map load hits the primary DB directly. At concurrent load, significant read pressure on the same instance handling writes.
- Scaling path: Short TTL cache (Redis or in-memory) for `list_reports`; or PostGIS read replica.

---

### Test Coverage Gaps

**No integration tests requiring a live database:**
- Risk: SQL query correctness (column names, JOIN behavior, enum casting) is not verified in CI. A typo in a column name compiles cleanly and only fails at runtime with a 500 error.
- Files: `backend/tests/`, all `#[cfg(test)]` modules
- Priority: High

**No E2E tests for the full submission flow:**
- Risk: Integration failures between frontend compression, multipart upload, and backend EXIF stripping are invisible in the current test suite.
- Files: `frontend/app/report/page.tsx`, `frontend/app/components/PhotoCapture.tsx`
- Priority: High

---

## Resolved Concerns

Concerns that have been closed by a specific phase. Listed for historical reference.

| Concern | Resolution | Phase |
|---------|-----------|-------|
| `COOKIE_SECURE` defaults to `false` in production docker-compose | Defaults to `true` in production; explicit `false` opt-out required for local dev | Phase 02.1 |
| `submitter_name` exposed in public unauthenticated API | Removed at struct level (`ReportResponse`) — compile-time guarantee; absent from all public responses | Phase 02.1 |
| Login page surfaces `body.message` from server error responses | Generic messages for all error states; raw server messages never displayed | Phase 02.1 |
| Password validation gap: client `< 8`, server `< 12` | Aligned to 12 characters on both frontend and backend | Phase 02.1 |
| Two `require_role` implementations with diverging semantics | Single canonical `require_role` from `crate::middleware::auth` with admin-is-superset semantics; duplicate in handlers removed | Phase 02.1 |
| `serde_json::to_value(...).unwrap()` in production handler paths | Replaced with `.map_err(|e| AppError::Internal(e.to_string()))?` in all production handlers | Phase 02.1 |
| No rate limiting on `POST /api/reports` beyond nginx 5r/m | `governor` crate adds per-IP per-geohash-6 rate limiting (2 reports/IP/geohash-6/hour) at the application layer | Phase 02 |
| No image deduplication or spam protection | SHA256 photo hash dedup (silent reject on exact match); honeypot hidden field; proximity dedup job (ST_DWithin 50m, 5-min poll) | Phase 02 |
| Public report list has no total count — pagination blind | `total` field added to `GET /api/reports` response via `count_reports()` concurrent query | PR #3 |
| Admin list_reports response shape mismatch between backend and frontend | `build_report_where_clause()` extracted; `count_admin_reports` added with `tokio::try_join!`; `total_count`/`total_pages` returned in admin list response | Phase 01-04 |
| Admin report JSON missing `image_url` and `updated_at` fields | `api_base_url` threaded through admin query functions; `image_url` computed and included in admin report JSON | Phase 01-04 |

---

## Accepted Risks

Known risks intentionally left in place with documented rationale.

**Two permanently broken tests in `admin/reports/map/__tests__/page.test.tsx`:**
- Symptom: Two `toHaveBeenCalledWith` assertions use an incorrect second argument; they always fail.
- Rationale: Test files are immutable per project rules (TDD contract). The behavioral contract is correct; only the assertion syntax is wrong. Accepted as permanent — CI shows 2 expected failures.

**Argon2id hashing on every failed login (including non-existent users):**
- Risk: Under a login spray attack, every request consumes significant CPU (~100–200ms).
- Rationale: This is correct timing-attack prevention. The nginx rate limit (5r/m on login endpoint) is the primary mitigation. Accepted as an intentional security trade-off.

**Image storage on Docker named volume with no automated backup:**
- Risk: `docker compose down -v` or host disk failure permanently destroys all uploaded photos.
- Rationale: Acknowledged operational risk. Acceptable at current scale (civic project, not yet launched). Migration path to S3/R2 is documented and ready. Until then: never run `docker compose down -v` on production.

---

## Stale / Superseded Concerns

Concerns that were valid at the time of the original audit but are no longer applicable.

**"No rate limiting on public `POST /api/reports` report submission beyond nginx 5r/m"** — *Superseded by Phase 02.* The `governor` crate adds application-layer rate limiting. The nginx layer still applies but is no longer the only protection.

**"No image deduplication or spam protection"** — *Superseded by Phase 02.* SHA256 photo hash dedup, honeypot field, and proximity duplicate detection are all implemented.

**"Admin list_reports total_count absent — frontend pagination UI non-functional"** — *Superseded by Phase 01-04.* Backend now returns `total_count` and `total_pages`. The open concern is the missing frontend pagination UI (no "next page" button), not the missing backend data.
