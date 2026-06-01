# Milestones — Bengaluru Walkability Public Audit

---

## v1.0 MVP — SHIPPED 2026-06-01

**Name:** v1.0 MVP  
**Status:** ✅ Shipped  
**Shipped:** 2026-06-01  
**Timeline:** 2026-03-04 → 2026-06-01 (89 days)

**Phases:** 18 substantive (1, 2, 2.1, 2.2, 2.3, 2.3.1, 2.3.2, 2.4, 2.4.1, 2.5, 2.6, 3, 3.1, 3.2, 3.3, 3.4, 4, 4.1)  
**Plans:** 59  
**Commits:** 683 total | 377 feat/fix/chore  
**LOC:** ~10,725 Rust + ~29,415 TypeScript

**Delivered:**  
Full-stack civic reporting platform with ward-level routing, government triage workflow, OWASP-hardened security, self-hosted infrastructure (Arch Linux + Cloudflare Tunnel), admin analytics dashboard, public stats, CSV/GeoJSON export, and redesigned citizen UI — ready for GBA soft launch.

**Key Accomplishments:**

1. **Ward-level routing** — 369 Bengaluru ward boundaries imported into PostGIS; every report auto-tagged to ward via ST_Within; org-scoped admin visibility via recursive CTE; wards.org_id linked to BBMP corporations via ILIKE migration (Phase 1 + Phase 04.1)
2. **Government triage workflow** — 6-state status lifecycle (Open → Acknowledged → Assigned → In Progress → Resolved → Closed) with status_history audit trail, org assignment, resolution notes and after-photo upload; public map reflects status in real time (Phase 3)
3. **Anti-abuse hardening** — Per-IP geohash-6 rate limiting (governor), CSS-offset honeypot with fake-200, SHA256 photo dedup, proximity duplicate detection (ST_DWithin 50m, 5-min async job); all silent with no user-visible error signals (Phase 2)
4. **Self-hosted infra + OWASP security** — Decommissioned Railway; Arch Linux desktop backend via Docker Compose + Cloudflare Tunnel; JPEG magic-bytes guard, nginx Content-Type hardening, COOKIE_SECURE prod default, weekly pg_dump + uploads backup with systemd timer, UptimeRobot /health monitor (Phases 02.1, 02.4, 02.4.1)
5. **Admin analytics + export** — Streaming CSV/GeoJSON export, materialized view public stats, admin analytics (top-10 wards, corporation resolution rate, 12-week trend chart, PostGIS ward choropleth with click-to-drilldown), heatmap layer on public map (Phase 4)
6. **Redesigned UI (citizen + admin)** — Walkable BLR design system (CSS tokens, next/font, 5 primitives), 2-step citizen report flow, hybrid admin console (JetBrains Mono chrome, Direction-B teal palette, light+dark mode), two-column split report detail layout (Phases 02.3.1, 02.5, 03.1)

**Requirements:** 51/51 satisfied (48 verified in audit; 3 NF-04.1 added + satisfied at close)  
**E2E flows:** 8/8 wired  
**Blockers at close:** 0

**Known deferred items at close:** 18 (see STATE.md Deferred Items)

**Archives:**
- `.planning/milestones/v1.0-ROADMAP.md` — full phase archive
- `.planning/milestones/v1.0-REQUIREMENTS.md` — requirements with final traceability
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — milestone audit report (tech_debt, no blockers)

---

*Next milestone: `/gsd-new-milestone` to define v1.1 scope*
