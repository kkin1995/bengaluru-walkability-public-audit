# Bengaluru Walkability Public Audit

## What This Is

A civic-tech platform where citizens photograph and geolocate subpar pedestrian infrastructure in Bengaluru. Reports are publicly visible on a map and feed into government workflows (GBA / city corporations) for resolution. Long-term, the accumulated data will power a Priority Walking Network (PWN) algorithm to guide infrastructure investment toward maximum public transit ridership impact.

## Core Value

Citizens can report a broken footpath in 60 seconds and the government can act on it — every report is a data point that builds the case for systemic walkability investment.

## Requirements

### Validated

- ✓ Citizen can submit a photo report with GPS coordinates (EXIF auto-extracted or manual pin) — Phase 1
- ✓ Report categories and severity levels captured at submission — Phase 1
- ✓ EXIF GPS extracted client-side (privacy-respecting; raw GPS never sent to server) — Phase 1
- ✓ EXIF metadata stripped server-side before image stored — Phase 1
- ✓ Location privacy: lat/lng rounded to 3 decimal places (~111m) in public API — Phase 1
- ✓ Bengaluru bounding-box validated server-side (no out-of-city submissions) — Phase 1
- ✓ PostGIS spatial storage (GEOGRAPHY type, ST_SetSRID trigger) — Phase 1
- ✓ Admin dashboard with JWT auth for report management — Phase 2
- ✓ Super-admin protection (deactivation guard, is_super_admin flag) — Phase 2
- ✓ Admin audit trail (status_history table) — Phase 2
- ✓ Public map showing submitted reports — Phase 1
- ✓ Nginx reverse proxy with rate limiting and CSP hardening — Phase 2
- ✓ CI/CD pipeline (GitHub Actions: frontend + backend + Docker build) — Phase 2
- ✓ Structured logging with request ID propagation (tracing + json) — Phase 2
- ✓ Optional reporter contact fields (name, phone) at submission — Phase 1

### Active

#### Public Map & Dashboard
- [ ] Enhanced public map with filtering by category, ward, and status
- [ ] Ward-level heatmap / issue density overlay
- [ ] Report status visible on public map (open / in progress / resolved)
- [ ] Media-ready shareable map views and summary statistics

#### Anti-Abuse & Data Quality
- [ ] Rate limiting on report submission (per IP, per time window)
- [ ] Duplicate detection — flag/merge reports for the same location and issue type
- [ ] Basic spam/bot prevention (e.g., submission throttling, honeypot field)
- [ ] Image content validation (file type, size, basic sanity checks)

#### Government Triage Workflow
- [ ] Ward-based report routing — reports auto-tagged to ward from coordinates
- [ ] Admin can assign reports to corporation / department
- [ ] Field team view — assigned reports with location, photo, category
- [ ] Status lifecycle: Open → Assigned → In Progress → Resolved → Closed
- [ ] Resolution notes and before/after photo on closing a report

#### Data Export & Analytics
- [ ] CSV export of reports with filters (date range, category, ward, status)
- [ ] GeoJSON export for GIS tools and PWN algorithm input
- [ ] Admin analytics dashboard: report counts by ward, category, status, trend over time
- [ ] Public summary stats (total reports, resolved count, top issue categories)

### Out of Scope

- PWN algorithm — future milestone after sufficient data collected (6–12 months post-launch)
- External government system integration (BBMP/GBA APIs) — pending GBA engagement via Walkaluru / Arun Pai
- SMS / WhatsApp reporter notifications — may add post-launch based on GBA requirements
- Native mobile app — web PWA is sufficient for MVP
- Citizen accounts / login — reports stay anonymous by default
- Real-time collaborative features — not needed at this scale

## Context

**Existing codebase:** Full implementation in progress — Rust/Axum backend (port 3001), Next.js 14 frontend (port 3000), PostGIS DB, Docker Compose. See CLAUDE.md for full architecture.

**Stakeholder path to launch:** Soft launch planned alongside Walkaluru (started by Arun Pai) which has GBA support. MVP must be solid enough to present to GBA as a credible civic tool. Multi-tier government workflow details TBD pending GBA engagement.

**GBA context:** BBMP has been dissolved; the Greater Bengaluru Authority (GBA) now oversees the 5 city corporations. Government workflow must be flexible enough to adapt to whatever structure GBA specifies.

**Data downstream use:** Reports feed three audiences — GBA planners (budget/repair prioritization), Walkaluru advocates (press, lobbying), and the future PWN algorithm (routing optimization using complaints + BMTC bus stops + Namma Metro stops).

**Abuse risk:** Primary concerns are spam/fake reports and duplicate submissions for the same location. Anonymous reporting increases abuse surface — rate limiting and duplicate detection are table stakes.

## Constraints

- **Tech stack**: Rust/Axum + Next.js 14 + PostGIS + Docker Compose — locked, no changes
- **Privacy**: Reports anonymous by default; location data rounded before public exposure; EXIF stripped
- **Security**: Public-facing app with anonymous submissions — must withstand spam and scraping
- **Stakeholder alignment**: Government workflow must remain flexible until GBA engagement completes
- **Timeline**: MVP needed before Walkaluru/GBA soft launch (date TBD)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Anonymous-by-default reporting | Lowers barrier to submission; protects reporters; Bengaluru civic context | — Pending validation |
| Rust/Axum backend | Type-safe, low memory, self-hostable — good fit for resource-constrained civic deployment | ✓ Good |
| PostGIS for spatial storage | Enables ward-level queries, proximity dedup, future PWN algorithm input | ✓ Good |
| Multi-tier gov routing (flexible) | GBA structure not yet confirmed — build adaptable workflow, not hardcoded org chart | — Pending |
| Soft launch with Walkaluru/GBA | External credibility and immediate real-world data vs. solo launch | — Pending |
| PWN algorithm deferred | Need minimum 6–12 months of real report data to make algorithm meaningful | — Pending |

---
*Last updated: 2026-03-11 after initialization*
