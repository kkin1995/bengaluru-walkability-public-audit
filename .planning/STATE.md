---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Stabilise, Launch, and Triage
current_phase: 07
status: "Phase 07 shipped — PR #22 (updated)"
stopped_at: Phase 07 UAT complete — all 4 re-verify2 tests pass, milestone v1.1 complete
last_updated: "2026-06-24T13:40:13.699Z"
last_activity: 2026-06-24
progress:
  total_phases: 21
  completed_phases: 21
  total_plans: 81
  completed_plans: 81
  percent: 100
current_phase_name: admin-triage-ux-public-map
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-05 after v1.1 roadmap created)

**Core value:** Citizens can report a broken footpath in 60 seconds and the government can act on it
**Current focus:** Milestone v1.1 complete — ready for /gsd-complete-milestone

## Current Position

Phase: 07
Status: Phase 07 shipped — PR #22 (updated)
Last activity: 2026-06-24

Progress: [██████████] 100%

## Performance Metrics

**Velocity (v1.0 reference):**

- Total plans completed (v1.0): 59
- Average duration: ~15 min/plan
- Total execution time: ~89 days

**By Phase (v1.1):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 5. UAT Stabilisation | TBD | — | — |
| 6. Production Launch | TBD | — | — |
| 7. Triage UX + Map | TBD | — | — |
| 06 | 5 | - | - |
| 07 | 13 | - | - |

*Updated after each plan completion*
| Phase 07 P03 | 1 min | 1 tasks | 1 files |
| Phase 07 P06 | 2min | 1 tasks | 1 files |
| Phase 07 P05 | 3min | - tasks | - files |
| Phase 07 P07 | 20min | 3 tasks | 7 files |
| Phase 07 P11 | 137s | 3 tasks | 4 files |
| Phase 07 P11 | 137 | 3 tasks | 4 files |
| Phase 07 P12 | 15min | 3 tasks | 2 files |
| Phase 07 P13 | 6m | 2 tasks | 2 files |
| Phase 07 P13 | 20m | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Key decisions from Phase 06 (see PROJECT.md Key Decisions for full log):

- [Phase 06]: Staging nginx runs on host port 3011 (production owns 80) — both stacks can run concurrently on same LXC; volumes postgres_staging_data + uploads_staging isolated
- [Phase 06]: deploy.yml uses full ref path `refs/heads/staging` / `refs/heads/main` in if: conditions — prevents branch-routing ambiguity
- [Phase 06]: frontend parked behind `profiles: [frontend-only]` in staging compose — staging stack starts db + backend + nginx only
- [Phase 06]: GSD config.json branching section added — /gsd-ship now routes PRs to staging; milestone merges go staging → main

Key decisions from Phase 07, Plan 01:

- [Phase 07-01]: corporation_id filter uses subquery pattern (reports.ward_id IN SELECT id FROM wards WHERE org_id = $N) rather than JOIN — keeps WHERE builder composable and additive on org_id CTE scoping
- [Phase 07-01]: ward_id and corporation_id typed as Option<Uuid> on AdminReportFilters — Axum Query extractor rejects non-UUID at deserialization (no explicit validation needed)
- [Phase 07-01]: build_export_where_clause passes None, None for ward/corp — export filtering is out of scope for Phase 07 (D-04)
- [Phase ?]: 07-03 complete
- [Phase ?]: [Phase 07-03]: Used 756x1008 proxy (1/4-scale of iPhone 3024x4032) for bake_orientation orientation=6 test - TEST-01 acceptance criterion satisfied
- [Phase ?]: [Phase 07-06]: Used inline CSS class + @media query for SSR-safe before/after photo grid in Next.js server component (avoids JS window width check)
- [Phase ?]: [Phase 07-06]: Resolution URL via split('/uploads/').pop() (FIX-01 pattern); date from last resolved/closed history entry; corp from ward_hierarchy?.corporation fallback 'GBA'
- [Phase 07-04]: Custom popover with position:absolute (not fixed) for corp/ward selects — iOS Safari scroll offset bug avoided; no third-party dropdown library (T-07-SC mitigated)
- [Phase 07-04]: corpIdRef + wardIdRef mirror categoryRef/statusRef pattern — avoids stale closure in fetchReports when geographic filters change
- [Phase ?]: [Phase 07-05]: STATUS_CHIPS uses publicStatusLabel; In progress = acknowledged|assigned|in_progress per D-07
- [Phase ?]: [Phase 07-05]: WardBoundaryLayer inside ReportsMap.tsx ssr:false; CSS var resolved at render with oklch fallback for Leaflet SVG
- [Phase 07-08]: TRIAGE-02 category chips confirmed pre-existing in map/page.tsx — smoke-verify only, no code change
- [Phase 07-08]: UAT verified on local Docker stack; ward-name-on-tap and corp-name text-search deferred as future enhancements
- [Phase 07-12]: Defense-in-depth focus suppression: CSS outline:none on .leaflet-interactive + programmatic blur() on ward polygon click — wardStyle fill:true/fillOpacity:0 left unchanged so TRIAGE-04 hover tooltip does not regress
- [Phase ?]: TrendChart uses useRef+ResizeObserver+useState to measure container width; LineChart renders only when width>0 — MOB-03 deferred-measurement race eliminated
- [Phase ?]: [Phase 07-13]: transformTrendData normalizes sparse category data — zero-fills missing category/week pairs so Recharts draws continuous line segments (second root cause of MOB-03)

### Pending Todos

None.

### Blockers/Concerns

- [Phase 5]: 13 bugs confirmed on iPhone iOS 26.5 (staging.nammadaari.com); some (FIX-04, FIX-05 — Leaflet iOS Safari) may require CSP or tile-provider changes; verify environment parity before fixing

## Deferred Items

Items carried forward from v1.0 close (2026-06-01):

| Category | Item | Status | Note |
|----------|------|--------|------|
| tech_debt | Dedup job excludes resolved but not closed (WARNING-01) | deferred | Out of scope v1.1 per REQUIREMENTS.md |
| tech_debt | AdminReport.image_url vs image_path type mismatch (WARNING-02/03) | deferred | Fallback in reports/[id]/page.tsx:75 prevents crash; may surface in FIX-01 |
| verification_gap | 6 phases at human_needed status | deferred | Live-deploy UAT outstanding from v1.0 |

## Session Continuity

Last session: 2026-06-24T09:00:00Z
Stopped at: Phase 07 complete, milestone v1.1 complete — ready for /gsd-complete-milestone v1.1
Resume file: None
