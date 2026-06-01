# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-06-01  
**Timeline:** 2026-03-04 → 2026-06-01 (89 days)  
**Phases:** 18 substantive (4 planned + 14 inserted) | **Plans:** 59 | **Commits:** 683

### What Was Built

- **Ward foundation** — 369 Bengaluru ward boundaries in PostGIS, auto-tagging, recursive CTE org-scoped visibility, wards linked to BBMP corporations via ILIKE migration
- **Anti-abuse controls** — Per-IP geohash-6 rate limiting, honeypot with fake-200, SHA256 photo dedup, 50m proximity duplicate detection with async 5-min poll
- **Government triage workflow** — 6-state status lifecycle, status_history audit trail, org assignment, resolution notes + after-photo upload, geographic org auto-assignment at report creation
- **Self-hosted infra** — Decommissioned Railway; Arch Linux desktop + Docker Compose + Cloudflare Tunnel + GitHub Actions self-hosted runner; JPEG magic-bytes guard, nginx Content-Type hardening, weekly backup systemd timer
- **Admin portal redesign** — Hybrid design system (JetBrains Mono, Direction-B teal, Direction-A card structure), light/dark mode, WCAG 1.4.1 severity indicators, two-column split report detail layout
- **Export + public analytics** — Streaming CSV/GeoJSON, materialized-view public stats page, admin analytics (ward choropleth, corporation resolution rate, 12-week trend chart), public heatmap

### What Worked

- **TDD discipline** — SQL-string unit tests (without live DB) caught regressions early (ADMIN_REPORT_DEDUP_COLS, CORP_ANALYTICS_SQL ::float8 cast). Establishing this pattern in Phase 2 paid dividends through Phase 04.1.
- **Decimal phase insertion** — The `X.Y` numbering scheme made 14 mid-milestone insertions traceable without breaking the numeric sequence. No confusion about execution order.
- **Async dedup job** — Separating the proximity dedup from the request path (5-min background poll) kept p99 submission latency clean while still catching duplicate floods quickly.
- **Cloudflare Tunnel + self-hosted runner** — Zero ongoing infra cost, no Railway dependency, automated deploys. Architecture is stable and maintainable by a 1-person team.
- **CSS variable token layer** — Both citizen UI (tokens.css) and admin UI (admin.css) as single-source-of-truth CSS variable layers made light/dark mode and design system evolution straightforward.
- **Fake-200 for abuse signals** — Honeypot and SHA256 dedup both return fake HTTP 200 — bots and double-tappers get no signal that detection occurred. Simple and effective.

### What Was Inefficient

- **14 inserted phases** — Only 4 of 18 phases were in the original roadmap. While insertion was handled cleanly, the volume indicates the initial milestone scope was optimistic. The original roadmap had no staging, no security hardening, no UI redesign, no infra migration — all of which were urgent blockers before GBA launch.
- **ANALYTICS-03 + WARD-03 late discovery** — Phase 4 shipped with CORP_ANALYTICS_SQL returning NaN because wards.org_id was never populated. The gap was found via the milestone audit 2 days after Phase 4 shipped, requiring Phase 04.1. A pre-Phase-4 integration check on wards.org_id population would have caught this earlier.
- **CONCURRENTLY index crash** — The Phase 03 materialized view trigger used REFRESH CONCURRENTLY on a constant-expression index — incompatible with CONCURRENTLY. Every Phase 3 mutation returned HTTP 500 until migration 012 fixed it. A quick smoke-test of the assign-org endpoint after Phase 03 shipped would have caught this immediately instead of at UAT.
- **6 human_needed verifications deferred** — Phases requiring live deployment verification (02.2, 02.4, 02.6, 03.2, 03.3, 03.4) ended with `human_needed` status. This is acceptable for infrastructure phases but created a backlog of unverified live behavior at milestone close.
- **Railway → self-hosted mid-milestone** — The Railway subscription expiry mid-milestone forced an emergency infrastructure pivot (Phase 02.4). Having a cost runway estimate at milestone start would have surfaced this earlier.

### Patterns Established

- **Org-scoping via recursive CTE** — `WITH RECURSIVE org_subtree` pattern for walking org hierarchy. Copy this for any future org-tree traversal query.
- **Handler DB lookup for auth** — Fetch calling user's metadata per-request (not from JWT claims) for auth-sensitive decisions. JWT claims hold only the user ID.
- **SQL-string unit tests without live DB** — Extract SQL fragments as module-level constants (`ADMIN_REPORT_DEDUP_COLS`, `CORP_ANALYTICS_SQL`) and test them with `str.contains()` assertions. Prevents query drift, works in CI without DB.
- **data-* attributes for CSS-variable-driven tests** — jsdom strips CSS var() from inline styles. Use `data-tone`, `data-variant`, `data-size`, `data-component` attributes for testable variant dispatch.
- **dynamic import with ssr: false for all map/chart components** — Leaflet uses `window`; recharts uses `window`. Both must be wrapped in `dynamic(() => import(...), { ssr: false })`. Establish this as a hard rule for any window-dependent component.
- **Idempotent migration guard** — `WHERE column IS NULL` guard on bulk UPDATE migrations (used in 014_link_wards_to_organisations.sql). Makes re-runs safe.

### Key Lessons

1. **Scope the infra and security phases upfront** — Staging deployment, OWASP hardening, and self-hosted infra migration are prerequisites for any public-facing launch. Build them into the milestone plan at the start, not as emergency insertions.
2. **Smoke-test integrations immediately after each phase ships** — Phase 03 materialized view crash and Phase 4 analytics NaN both survived into UAT because no one ran a quick end-to-end check after the phase landed. A 10-minute smoke test would have caught both.
3. **Link foreign keys before building analytics** — CORP_ANALYTICS_SQL assumed wards.org_id was populated; it wasn't. For analytics that JOIN through a FK chain, verify the chain is populated with real data before writing the query.
4. **Verify env vars match code** — Local CORS_ORIGIN misconfiguration (wrong port) caused "Couldn't load reports" during verification. A preflight env-check script would reduce this class of false failures.
5. **Fake-200 for all anti-abuse checks** — No error signal on honeypot, photo dedup, or rate limiting. The attacker (and the double-tapping user) gets no information about why their submission "succeeded" with no effect. Extend this to any future anti-abuse control.

### Cost Observations

- Model mix: predominantly sonnet-4.x for execution; opus for planning/audit phases
- Sessions: multiple over 89 days across 18 phases
- Notable: SQL-string TDD (no live DB required) kept CI costs low and test reliability high. The biggest token investment was in audit passes (milestone audit consumed 103 tool uses from gsd-integration-checker).

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Inserted Phases | Key Change |
|-----------|--------|-------|-----------------|------------|
| v1.0 MVP | 18 | 59 | 14 of 18 | First milestone; established all core patterns |

### Top Lessons (v1.0)

1. Scope security + infra upfront — they're prerequisites, not polish
2. Smoke-test integrations immediately after each phase; don't wait for UAT
3. Verify FK chains are populated before writing analytics queries that JOIN through them
