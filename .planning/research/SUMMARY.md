# Project Research Summary

**Project:** Bengaluru Walkability Public Audit
**Domain:** Civic issue reporting / government triage / geospatial analytics
**Researched:** 2026-03-11
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a brownfield civic-tech platform: the citizen-facing submission and admin dashboard already exist (Phases 1 and 2 done). The next increment closes the loop between citizen reports and government action — ward auto-routing, anti-abuse hardening, a full government triage workflow, and public analytics/export. The technical stack is locked (Rust/Axum + Next.js 14 + PostGIS + Docker Compose). What's needed are targeted library additions (`governor` for rate limiting, `csv` crate for export, `recharts` and `leaflet.heat` for frontend dashboards) plus PostGIS materialized views for analytics — no architectural rewrites required.

The recommended approach follows a strict dependency order dictated by the feature graph. Ward boundary data must come first because duplicate detection, triage routing, and ward-level analytics all depend on it. Anti-abuse hardening comes second to protect the system before any public launch. Government workflow comes third — it cannot be built until the org structure (wards → corporations → GBA) is in place. Export and public analytics come last because they aggregate data that only makes sense once reports are being actively triaged. Skipping this order would produce features that either cannot be tested or will require rework.

The primary risk is not technical — it is adoption. The #1 failure mode of civic tech in India is a government portal that no one logs into. The ward boundary data quality issue is a close second: mis-routing reports to the wrong corporation destroys government trust faster than any bug. Both risks have mitigation strategies (soft launch with a GBA champion, manual ward correction workflow, admin organization UI) that must be baked into Phase 1 and 3 respectively, not treated as post-launch polish.

---

## Key Findings

### Recommended Stack

The existing stack handles all new requirements without architectural additions. PostGIS already provides `ST_Within`, `ST_DWithin`, `ST_AsGeoJSON`, and materialized view support — no new spatial database needed. The only net-new backend dependency is the `governor` crate (0.6) for in-process token-bucket rate limiting as an Axum middleware layer; this complements the existing Nginx `limit_req_zone` without Redis overhead. The `csv` crate (1.3) and `geojson` crate (0.24) cover the export pipeline; `serde_json` is already present for GeoJSON. For the ward boundary import, the `shapefile` crate (0.6) covers SHP format as a fallback if OSM GeoJSON proves incomplete.

On the frontend, `recharts` (2.12) is the correct choice for analytics charts — React-native, SSR-compatible, lighter than Chart.js. For the ward heatmap, `leaflet.heat` (0.2) integrates with the existing `react-leaflet` setup. Ward choropleth overlays use `react-leaflet`'s built-in `GeoJSON` layer with a dynamic style function — no additional library. The export trigger requires no library; the browser handles streaming download via `Content-Disposition: attachment`.

**Core technology additions:**
- `governor` (Rust, 0.6): Per-IP token-bucket rate limiting as Axum middleware — standard Rust choice, no Redis
- `csv` crate (Rust, 1.3): Streaming CSV serialization for export endpoint
- `geojson` crate (Rust, 0.24): Parse ward boundary GeoJSON for migration import
- PostGIS materialized views: Pre-aggregated ward stats refreshed hourly — no additional analytics DB
- `recharts` (React, 2.12): Bar/trend charts for admin and public analytics dashboard
- `leaflet.heat` (0.2): Heatmap density layer on existing Leaflet map

**Do NOT add:** Redis (overkill for rate limiting at MVP scale), Elasticsearch, message queues, ML spam detection, or ClickHouse. PostgreSQL materialized views are sufficient until 1M+ rows.

### Expected Features

Reference platforms (FixMyStreet, SeeClickFix, Seva Sindhu, BBMP Sahaaya) converge on a clear lesson: anonymous-first + photo + public map are table stakes that cannot be traded away, and government-facing triage is as important as citizen-facing submission. The biggest differentiation opportunity is ward-level aggregation that makes data policy-relevant — this is what makes GBA want to use the platform rather than just tolerate it.

**Must have (table stakes — 12 features, MVP-critical):**
- Report status visible on public map — closes the accountability loop
- Ward auto-tagging from GPS coordinates — routes reports without manual triage
- Status lifecycle (Open → Acknowledged → Assigned → In Progress → Resolved → Closed)
- Admin triage queue with ward/status filters
- CSV export (GBA planners use Excel; GeoJSON literacy cannot be assumed)
- GeoJSON export (researchers and future PWN algorithm need geospatial format)
- Duplicate detection with "me too" count (flag only — never auto-hide)
- Per-IP application-layer rate limiting (`governor` middleware)
- Honeypot field for bot prevention
- Basic public stats page (total / by category / top wards)
- Image content validation (file type, size, sanity check)
- Enhanced public map filtering (by category, ward, status)

**Should have (differentiators — 10 features, v1 post-launch):**
- Ward-level heatmap on public map (visual = political; councillors respond)
- Before/after photo comparison on resolution (proof without auditor)
- Trend charts per category over time (policy feedback loop)
- Field team mobile view (assigned reports, direct camera capture)
- "Me too" upvote on individual reports (severity signal for triage)
- Admin analytics: top 10 wards by unresolved count (answers the #1 political question)
- Ward comparison table across corporations (inter-corporation accountability)
- Shareable report permalink (press and advocacy groups need linkable URLs)
- GeoJSON ward overlay on public map (ward boundary + issue density)
- Public resolution rate by ward (accountability index)

**Defer to v2+:**
- SMS/WhatsApp notifications (TRAI DLT registration adds months; use public map instead)
- Public GeoJSON export (expose only resolved reports with rounded coords; PII risk now)
- Real-time analytics (materialized views refreshed hourly are sufficient)
- PWN algorithm integration (needs 6–12 months of real data first)
- Native mobile app (web PWA is sufficient for MVP)

### Architecture Approach

Five new components integrate into the existing architecture without touching the existing Rust handler structure significantly. The ward boundary layer uses a PostgreSQL trigger (not application code) to ensure `ward_id` is always set on insert, even on direct DB writes. The duplicate detection algorithm is a pure PostGIS query (`ST_DWithin` + same category + 30-day window) run synchronously in the submission handler — no background job needed at MVP scale. The government triage workflow uses a flexible self-referential `organizations` table (id, name, type, parent_id) so the GBA → corporation → ward office hierarchy can be seeded as data, not hardcoded. The export pipeline streams responses via `sqlx`'s `.fetch()` cursor to prevent OOM on large tables. Public analytics use materialized views refreshed hourly, with separate public (`/api/stats`) and admin (`/api/admin/analytics`) endpoints.

**Major components and build order:**
1. **Ward Boundary Layer** — `wards` table + PostGIS boundary import + auto-tagging trigger on `reports`; `organizations` table + admin org assignment
2. **Anti-Abuse & Quality** — `governor` middleware (5 reports/hour/IP), honeypot field, hash-based duplicate photo detection, 50m `ST_DWithin` duplicate flagging
3. **Government Triage Workflow** — status lifecycle expansion, admin triage queue with ward/org filters, field team view, resolution photo upload
4. **Export & Public Analytics** — streaming CSV/GeoJSON endpoints, materialized views, public stats API, recharts dashboard, leaflet heatmap

### Critical Pitfalls

1. **Ward boundary data is wrong** — BBMP's 198 wards were reorganized under GBA; OSM data may be pre-2024. Prevention: store `ward_source` + `boundary_updated_at` metadata, build admin UI for manual ward correction on individual reports, contact Datameet Bengaluru for verified boundaries. Accept approximate at launch; build correction workflow into Phase 1.

2. **Government never logs in** — The #1 civic tech failure mode. GBA staff will open it once, find it confusing, and revert to WhatsApp. Prevention: build simpler than you want for v1, get a GBA champion (Arun Pai / Walkaluru) before launch, plan a 30-minute in-person onboarding session, send weekly email digest to pull admins back in, ensure field team view works on basic Android on 4G.

3. **Duplicate detection is too aggressive** — Auto-suppressing reports hides legitimate issues and makes scale invisible to government. Prevention: NEVER auto-hide duplicates; flagging is for admin review only; public map always shows all reports; duplicate_count becomes severity signal in triage queue; 50m threshold must be admin-tunable.

4. **PostGIS SRID confusion breaks spatial queries** — Ward boundary GeoJSON may import as SRID 0 or 3857 (Web Mercator); `ST_Within` between mismatched SRIDs silently returns wrong results. Prevention: always `ST_Transform(geometry, 4326)` on import, add `CHECK (ST_SRID(boundary) = 4326)` constraint, test with 10 known lat/lng pairs before deploying trigger.

5. **CSV export becomes primary government interface** — GBA planners will download CSV and do their own analysis in Excel. If export is slow, missing columns, or uses ISO dates, the data pipeline to government breaks. Prevention: interview GBA planner before building export, include ward name (not ID), DD/MM/YYYY dates, Kannada category labels alongside English, use streaming response, test with 10,000+ rows.

---

## Implications for Roadmap

Based on the combined feature dependency graph and pitfall analysis, four phases are recommended. The ordering is non-negotiable: ward data gates duplicate detection and triage routing; anti-abuse gates public launch; government workflow gates analytics that have meaningful data.

### Phase 1: Ward Foundation

**Rationale:** All downstream features — duplicate detection, triage routing, ward-level analytics — require ward boundaries and the organizations hierarchy. This is the architectural foundation, not a feature.

**Delivers:** Ward auto-tagging on all new and existing reports; flexible organization hierarchy for GBA's evolving structure; public map enhanced with ward boundary overlay.

**Addresses (from FEATURES.md):** Ward auto-tagging, admin ward filter, GeoJSON ward overlay on public map.

**Avoids (from PITFALLS.md):** SRID confusion (SRID check constraint + transform on import); stale boundaries (ward_source metadata + admin correction UI); hardcoded org structure (self-referential organizations table seeded as data).

**Stack additions:** `geojson` crate (ward import), `shapefile` crate (SHP fallback), PostGIS `ST_Within` trigger, `L.GeoJSON` layer on frontend.

### Phase 2: Anti-Abuse and Data Quality

**Rationale:** The platform accepts anonymous photo submissions from the public internet. Before any press or GBA launch, the abuse surface must be hardened. Duplicate detection also requires ward data to be accurate (ward context improves clustering), so it comes after Phase 1.

**Delivers:** Per-IP rate limiting (governor middleware), honeypot bot prevention, duplicate flagging with "me too" count, image validation improvements, hash-based duplicate photo detection.

**Addresses (from FEATURES.md):** Per-IP rate limiting, duplicate detection, honeypot, image content validation, "me too" vote count.

**Avoids (from PITFALLS.md):** Anonymous reporting abuse spikes at launch; duplicate detection too aggressive (flag only, never hide, tunable threshold).

**Stack additions:** `governor` crate (0.6) as Axum middleware, `axum-extra` for IP extraction.

### Phase 3: Government Triage Workflow

**Rationale:** This is the feature set that makes GBA want to use the platform. It depends on both ward routing (Phase 1) and a clean data set (Phase 2 anti-abuse). Building government workflow before anti-abuse would expose GBA to an unmanaged abuse spike during onboarding.

**Delivers:** Full status lifecycle (Open → Acknowledged → Assigned → In Progress → Resolved → Closed), admin triage queue with ward/org/status filters, field team mobile view with direct camera capture, resolution notes and before/after photo, report assignment to organization, weekly email digest capability.

**Addresses (from FEATURES.md):** Status lifecycle, admin triage queue, field team view, before/after photo, resolution rate by ward, report status visible on public map.

**Avoids (from PITFALLS.md):** Government never logs in (simpler v1 interface, in-person onboarding, weekly digest); soft launch generates negative press (shadow period, pre-agree 72-hour SLA); GBA org structure changes mid-build (organizations table is data not code, admin UI to rename/reassign).

### Phase 4: Export and Public Analytics

**Rationale:** Analytics are only meaningful once real triage data exists (statuses changing, resolutions happening, ward assignments accurate). Export and dashboard come last because they surface the data that Phases 1–3 generate.

**Delivers:** Streaming CSV export (GBA Excel workflow), GeoJSON export (researchers, PWN algorithm input), public stats page (total reports / by category / top wards), admin analytics dashboard (top 10 wards by unresolved, resolution rate by corporation, trend charts), PostGIS materialized views refreshed hourly, ward-level heatmap on public map.

**Addresses (from FEATURES.md):** CSV export, GeoJSON export, public summary stats, admin analytics, ward heatmap, trend charts, shareable report permalink.

**Avoids (from PITFALLS.md):** CSV export becomes broken government interface (interview planner before build, Kannada labels, DD/MM/YYYY dates, streaming to prevent timeout); analytics dashboard built for developer not GBA (lead with "top 10 wards by unresolved count", plain-language labels).

**Stack additions:** `csv` crate (1.3), `recharts` (2.12), `leaflet.heat` (0.2), PostgreSQL materialized views + `pg_cron` or hourly refresh.

### Phase Ordering Rationale

- Ward data gates four other feature areas (heatmap, duplicate detection, triage routing, analytics). It must be Phase 1.
- Anti-abuse must precede any public-facing launch to protect system credibility and government trust.
- Government workflow must be simpler than you want in v1 — build the minimum that GBA will actually use before adding features. Complexity is a government adoption killer (Seva Sindhu and BBMP Sahaaya both failed this way).
- Analytics and export come last because they surface aggregate data that only has value after phases 1–3 generate a meaningful dataset.

### Research Flags

Phases needing deeper research during planning:

- **Phase 1 (Ward Foundation):** Ward boundary data source requires validation before committing to a migration approach. OSM Overpass API is the recommended source but GBA ward structure post-BBMP is in flux. Contact Datameet Bengaluru before writing the import migration. SRID handling in the trigger needs a test harness.
- **Phase 3 (Government Workflow):** GBA org structure is unconfirmed. Multi-tier routing details (which corporation owns which wards) must be validated with Arun Pai / Walkaluru before the organizations seed migration is written. The field team UX requires at least one in-person session with a GBA field officer before building.

Phases with standard patterns (skip research-phase):

- **Phase 2 (Anti-Abuse):** `governor` crate is well-documented; honeypot pattern is well-understood; `ST_DWithin` duplicate query follows established PostGIS patterns.
- **Phase 4 (Export & Analytics):** Streaming CSV with `sqlx` + `csv` crate is a known Rust pattern; `recharts` documentation is thorough; materialized view refresh is standard PostgreSQL.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack is locked and well-understood; additions (`governor`, `csv`, `recharts`, `leaflet.heat`) are standard choices with strong community consensus |
| Features | HIGH | FixMyStreet retrospectives and mySociety research are high-quality sources; Indian context analysis is well-grounded in documented failures (Seva Sindhu, BBMP Sahaaya) |
| Architecture | HIGH | Build order follows strict dependency logic; PostGIS trigger pattern is well-established; streaming export is standard Axum/sqlx pattern |
| Pitfalls | MEDIUM-HIGH | Ward boundary data quality is a known risk but exact GBA ward structure is unverified; government adoption risk is well-documented in civic tech literature but GBA-specific behavior is unknown until engagement |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **GBA ward boundary data:** Which specific source (OSM, Datameet, official BBMP/GBA) is current and accurate post-2024 restructuring. Handle by: contact Datameet Bengaluru before Phase 1 migration; build admin correction UI regardless of source.
- **GBA org structure:** How GBA divides responsibility across the 5 corporations and which wards fall under which corporation. Handle by: build organizations table as data (not hardcoded), delay populating with specific corporations until Arun Pai engagement confirms structure.
- **GBA user behavior:** Whether GBA staff will actually use a web-based triage interface or will default to requesting CSV. Handle by: plan in-person onboarding session before Phase 3 launch; treat the weekly email digest as mandatory, not optional.
- **CSV column requirements:** GBA planners almost certainly have existing Excel templates with specific column expectations. Handle by: interview GBA planner before writing export endpoint (not after).

---

## Sources

### Primary (HIGH confidence)
- mySociety FixMyStreet published retrospectives — anonymous reporting adoption rates, government workflow design
- PostGIS official documentation — `ST_Within`, `ST_DWithin`, `ST_AsGeoJSON`, materialized view patterns
- Axum / `governor` crate documentation — rate limiting middleware patterns
- OSM Overpass API — Bengaluru ward boundary availability

### Secondary (MEDIUM confidence)
- Code for America civic tech field guide — pitfall patterns for government adoption
- Datameet India civic data repository — Bengaluru ward boundary availability and format
- mySidewalk and SeeClickFix product documentation — government triage queue design patterns

### Tertiary (LOW confidence)
- Karnataka government digital service patterns — inferred from documented Seva Sindhu and BBMP Sahaaya failures; not validated by direct GBA engagement
- GBA ward structure post-BBMP dissolution — structure is in flux; validate before Phase 1 implementation

---
*Research completed: 2026-03-11*
*Ready for roadmap: yes*
