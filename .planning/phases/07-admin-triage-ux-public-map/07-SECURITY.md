---
phase: 07
slug: admin-triage-ux-public-map
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-24
audited: 2026-06-24
---

# Phase 07 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> All mitigations verified by grep against implementation files — documentation or
> intent was not accepted as evidence.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser→admin API | Admin filter, corp/ward options, report list requests | Admin JWT cookie gating on `admin_protected_router`; UUID-typed query params |
| internet→public API | Unauthenticated ward GeoJSON, report pins | Geographic data only (ward_name, ward_number, geometry); no PII, no counts |
| admin API→Postgres | corp_id, ward_id params flow into SQL WHERE clauses | Parameterized `$N` binds only; values never string-interpolated |
| browser rendering | Client-side status/category filter; ward GeoJSON overlay | All data already public; no new trust boundary introduced |
| admin browser rendering | TrendChart ResizeObserver; admin analytics | Inside authenticated portal; no new data boundary |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-07-01 | Elevation of Privilege | `/api/admin/corporations`, `/api/admin/wards` | mitigate | Both routes registered inside `admin_protected_router` with `require_auth` middleware layer; `admin_list_corporations` and `admin_list_wards` both accept `Extension(_claims): Extension<AuthJwtClaims>` confirming auth gate | CLOSED |
| T-07-02 | Tampering/Injection | `corp_id`, `ward_id` query params → SQL | mitigate | `AdminReportFilters.ward_id` and `.corporation_id` typed as `Option<uuid::Uuid>`; `WardFilterParams.corp_id` typed as `Option<Uuid>`; SQL uses `format!("... = ${}", param_idx)` for clause structure with `.bind(id)` for values — no string interpolation of user input | CLOSED |
| T-07-03 | Information Disclosure | Scoped admin filtering by ward outside their org | accept | See Accepted Risks Log AR-07-01 | CLOSED |
| T-07-04 | Elevation of Privilege | `/api/wards/boundaries` (public endpoint) | mitigate | Handler `public_get_ward_boundaries` returns only `ward_name` + `ward_number` + geometry; no `unresolved_count`, no internal UUIDs; registered on the unauthenticated public `app` Router (not `admin_protected_router`) in `main.rs` line 285-288 | CLOSED |
| T-07-05 | Spoofing/auth bypass | `/api/admin/wards/boundaries` (admin choropleth) | mitigate | Route remains inside `admin_protected_router` (main.rs lines 264-267); `getWardBoundaries()` in `adminApi.ts` calls `${BASE}/api/admin/wards/boundaries` (line 492) — old public path removed | CLOSED |
| T-07-06 | Denial of Service | Public ward endpoint flooding | accept | See Accepted Risks Log AR-07-02 | CLOSED |
| T-07-07 | n/a | `bake_orientation` unit test | accept | See Accepted Risks Log AR-07-03 | CLOSED |
| T-07-08 | Tampering | `corp_id`/`ward_id` from frontend client | mitigate | Same as T-07-02: backend types both as `Option<Uuid>`, binds as SQL parameters. UI sends only IDs returned by admin option endpoints (getAdminCorporations/getAdminWards wiring confirmed in `adminApi.ts`) | CLOSED |
| T-07-09 | Information Disclosure | Admin querying across orgs | accept | See Accepted Risks Log AR-07-04 | CLOSED |
| T-07-10 | Information Disclosure | Public ward GeoJSON consumed by public map | accept | See Accepted Risks Log AR-07-05 | CLOSED |
| T-07-11 | Denial of Service | Repeated overlay toggles causing refetches | mitigate | `wardBoundariesGeojson` state cached after first success (map/page.tsx lines 107-108: `if (wardBoundariesGeojson) { /* Already cached — reuse without refetch */`); no re-fetch on subsequent ON toggles | CLOSED |
| T-07-12 | Tampering | Malformed GeoJSON response crashing map | mitigate | Failure path sets `wardBoundariesStatus("error")` (map/page.tsx line 123) and silently greys the toggle button; no unhandled exception; `wardBoundariesStatus === "error"` gate confirmed at line 511 | CLOSED |
| T-07-13 | Information Disclosure | Resolution photo URL on public page | accept | See Accepted Risks Log AR-07-06 | CLOSED |
| T-07-14 | Tampering | Missing/null `resolution_photo_url` | mitigate | `hasResolutionPhoto` computed as `publicResolutionUrl !== "" && isResolved` (reports/[id]/page.tsx line 410); absent URL falls back to single `PhotoFrame` labeled "Photo" with `maxWidth: 520px` — no crash, no After slot | CLOSED |
| T-07-15 | n/a | Admin CSS + chart config | accept | See Accepted Risks Log AR-07-07 | CLOSED |
| T-07-16 | n/a | UAT checklist + sign-off | accept | See Accepted Risks Log AR-07-08 | CLOSED |
| T-07-11-01 | Information Disclosure | Public `/map` client-side status filter | accept | See Accepted Risks Log AR-07-09 | CLOSED |
| T-07-12-01 | Tampering | `globals.css` focus outline removal | accept | See Accepted Risks Log AR-07-10 | CLOSED |
| T-07-13-01 | Denial of Service | `ResizeObserver` in TrendChart | accept | See Accepted Risks Log AR-07-11 | CLOSED |
| T-07-SC-01 | Tampering | Cargo supply chain (Plan 01) | mitigate | `backend/Cargo.toml` last modified in Phase 5 PR (#19); no changes in any phase 07 commit — confirmed via `git log --oneline backend/Cargo.toml` | CLOSED |
| T-07-SC-02 | Tampering | Cargo supply chain (Plan 02) | mitigate | Same as T-07-SC-01: no Cargo.toml changes in phase 07; axum header utilities (`header::CACHE_CONTROL`) pre-existing | CLOSED |
| T-07-SC-03 | Tampering | Cargo supply chain (Plan 03) | mitigate | Same as T-07-SC-01: `image` crate already in tree; no new install | CLOSED |
| T-07-SC-04 | Tampering | npm supply chain (Plan 04) | mitigate | `frontend/package.json` last modified in Phase 4 era (commit `bb7a028`); no changes in any phase 07 commit — confirmed via `git log --oneline frontend/package.json`; custom popover built from React primitives (no third-party dropdown) | CLOSED |
| T-07-SC-05 | Tampering | npm supply chain (Plan 05) | mitigate | Same as T-07-SC-04: react-leaflet + geojson types already present; no new install | CLOSED |
| T-07-SC-06 | Tampering | npm supply chain (Plan 06) | mitigate | Same as T-07-SC-04: no new npm package | CLOSED |
| T-07-SC-07 | Tampering | npm supply chain (Plan 07) | mitigate | Same as T-07-SC-04: Recharts + react-leaflet already present; no new install | CLOSED |
| T-07-SC-08 | Tampering | npm/cargo supply chain (Plan 08) | mitigate | No installs in the UAT/documentation plan; confirmed by commit log | CLOSED |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-03 | Scoped admin filtering by ward outside their org yields zero rows — existing `org_id` recursive CTE applies as an AND condition. Out-of-scope ward selections produce empty results; no data is leaked. No additional control needed at ASVS L1. | Phase plan author | 2026-06-22 |
| AR-07-02 | T-07-06 | Public ward GeoJSON endpoint has no per-IP rate limit. Nginx `location = /api/wards/boundaries` block sets `Cache-Control: public, max-age=86400` (set by Axum handler; nginx passes it through). Cloudflare edge caching ensures negligible origin hit rate. Accepted per D-23. | Phase plan author | 2026-06-23 |
| AR-07-03 | T-07-07 | `bake_orientation` unit test is a pure in-memory function with synthetic JPEG input. No I/O, no network, no untrusted input crosses any trust boundary. Zero security surface. | Phase plan author | 2026-06-22 |
| AR-07-04 | T-07-09 | Scoped admins querying wards/corps outside their org hierarchy: the ward option list (`list_wards_for_filter`) and the report query both apply org-scoped filtering server-side via the recursive org CTE. Out-of-scope selections yield empty results. | Phase plan author | 2026-06-23 |
| AR-07-05 | T-07-10 | Public ward GeoJSON contains only `ward_name`, `ward_number`, and polygon geometry — no PII, no report counts, no internal UUIDs. Safe to expose on an unauthenticated endpoint; geographic ward boundaries are public civic data. | Phase plan author | 2026-06-23 |
| AR-07-06 | T-07-13 | Resolution photos served from the same `/uploads/` path as original submission photos. Resolution photos are intentionally public for resolved civic reports — they demonstrate the fix applied. Same trust model as the already-public submission photos. | Phase plan author | 2026-06-22 |
| AR-07-07 | T-07-15 | Admin CSS utilities (`safe-area-inset-bottom`) and Recharts/Leaflet configuration changes are presentation-only inside the already-authenticated admin portal. No data flow, no new endpoints, no security surface. | Phase plan author | 2026-06-23 |
| AR-07-08 | T-07-16 | UAT checklist is a documentation/verification artifact. No executable code, no endpoint, no data crossing a trust boundary. | Phase plan author | 2026-06-23 |
| AR-07-09 | T-07-11-01 | Client-side status/category filter operates on already-public GeoJSON data with privacy-rounded coordinates (~111 m). Filtering exposes no new data; it only restricts which already-visible pins are shown. | Phase plan author | 2026-06-24 |
| AR-07-10 | T-07-12-01 | CSS `outline: none` on `.leaflet-interactive:focus` removes the focus outline from ward polygon SVG paths. Ward polygons are informational overlays marked `aria-hidden="true"` — they are not keyboard-operable UI controls. Removing the focus outline does not affect keyboard accessibility of any interactive element (report markers, FAB, filter chips). | Phase plan author | 2026-06-24 |
| AR-07-11 | T-07-13-01 | `ResizeObserver` in TrendChart uses a single observer on one container element, disconnected on unmount via the `useEffect` cleanup. Width-state updates are bounded (one update per layout change). No denial-of-service surface within the authenticated admin analytics page. | Phase plan author | 2026-06-24 |

---

## Unregistered Threat Flags

None. All threat flags in SUMMARY.md `## Threat Flags` sections either map to existing threat IDs or were explicitly reported as "None" by the executor. No new attack surface appeared without a corresponding threat mapping.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-24 | 27 | 27 | 0 | gsd-security-auditor (Claude Sonnet 4.6) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
