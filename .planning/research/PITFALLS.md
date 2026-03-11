# Pitfalls Research: Civic Reporting Platform

**Dimension:** Common failures in civic issue reporting, anonymous submissions, and Indian government tech adoption
**Date:** 2026-03-11

---

## Pitfall 1: Ward Boundary Data Is Wrong

**Description:** Bengaluru ward boundaries changed significantly with GBA formation (BBMP's 198 wards reorganized). Using stale OSM or BBMP data will mis-route reports to wrong corporation, destroying government trust in the system.

**Warning signs:**
- Reports showing ward boundaries that cross known neighborhood lines
- GBA officials saying "this report is in our ward but it shows Corporation X"
- OSM ward data last updated pre-2024

**Prevention:**
- Store `ward_source` and `boundary_updated_at` metadata in wards table
- Build admin UI to manually correct ward assignment on individual reports
- Accept that boundaries will be approximate at launch — build correction workflow
- Contact Datameet Bengaluru community for verified ward boundaries

**Phase:** Ward Foundation (Phase 1 of build order)

---

## Pitfall 2: Anonymous Reporting Creates Abuse Spikes at Launch

**Description:** Every civic app that launches publicly gets flood-tested by bots and antagonistic actors within 48 hours. Rate limiting at Nginx only protects at IP level — coordinated abuse from multiple IPs will saturate the DB with fake reports.

**Warning signs:**
- Sudden spike in submissions from diverse IPs in short window
- Reports in impossible locations (middle of Ulsoor Lake)
- Reports with identical photos uploaded many times

**Prevention:**
- Application-layer rate limiting (`governor` crate) per IP: max 5 reports/hour per IP
- Bengaluru bounding box validation already exists — enforce strictly
- Add honeypot field (`<input type="hidden" name="website">`) — bots fill it, humans don't
- Hash-based duplicate photo detection (SHA256 of compressed image) to catch repeat uploads
- "Soft launch" with Walkaluru community first — seeded with trusted reports before press attention

**Phase:** Anti-Abuse (Phase 2 of build order)

---

## Pitfall 3: Government Never Logs In

**Description:** The #1 failure mode of civic tech is building a triage system that government doesn't use. GBA staff will open it once, find it confusing, and go back to WhatsApp. This is what happened to BBMP's own Sahaaya portal.

**Warning signs:**
- Admin hasn't logged in for >7 days post-launch
- Reports remain in "Open" status indefinitely
- Staff asks "can I get this as an Excel file?"

**Prevention:**
- Get a champion inside GBA before launch (Arun Pai / Walkaluru is this champion — protect this relationship)
- Send weekly email digest to GBA admins: "12 new reports in your ward this week" — pull them back in
- The field team view must work on a basic Android phone with a 4G connection
- First version of government interface should be SIMPLER than what you want, not feature-complete
- Plan a 30-minute in-person onboarding session with the first GBA user

**Phase:** Government Workflow (Phase 3 of build order)

---

## Pitfall 4: CSV Export Becomes the Primary Government Interface

**Description:** GBA planners will not use a web dashboard. They will download CSV, open Excel, and do their own analysis. If the CSV export is missing columns, has wrong date formats, or is slow to generate, the data pipeline to government breaks.

**Warning signs:**
- GBA planner asks "can you add the ward name column?"
- Export takes >30 seconds and times out
- Dates exported in ISO 8601 — Indian government uses DD/MM/YYYY

**Prevention:**
- Interview GBA planner before building export (ask to see their existing Excel templates)
- Export ward name (not just ward ID), human-readable dates (DD/MM/YYYY), Kannada category names alongside English
- Use streaming response to prevent timeout on large exports
- Test with 10,000+ row dataset before launch

**Phase:** Export & Analytics (Phase 4 of build order)

---

## Pitfall 5: Duplicate Detection Is Too Aggressive

**Description:** If duplicate detection auto-suppresses reports, you'll hide legitimate issues. A footpath that's broken in 5 places for 200 meters will be collapsed to 1 report. This makes the scale of the problem invisible to government.

**Warning signs:**
- Admin seeing "duplicate" flags on reports that are clearly different issues
- Citizens saying "I submitted but I can't see my report on the map"
- Ward count artificially low because duplicates are suppressed

**Prevention:**
- NEVER auto-hide duplicate reports — they must remain visible on the public map
- Duplicate flag is a signal to admin, not a filter on public visibility
- "Me too" count on original report is more valuable than suppression
- 50m radius threshold should be tunable by admin (some issues genuinely repeat every 50m on a long road)

**Phase:** Anti-Abuse (Phase 2 of build order)

---

## Pitfall 6: PostGIS SRID Confusion Breaks Spatial Queries

**Description:** Reports are stored as `GEOGRAPHY(POINT, 4326)`. Ward boundaries imported from GeoJSON may default to SRID 0 or 3857 (Web Mercator). `ST_Within` between mismatched SRIDs silently returns incorrect results or errors.

**Warning signs:**
- All reports show `ward_id = NULL` after import
- ST_Within returns false for points visually inside a polygon
- PostGIS warning: "Operation on mixed SRID geometries"

**Prevention:**
- Always `ST_Transform(geometry, 4326)` on import of ward boundary data
- Add constraint: `CHECK (ST_SRID(boundary) = 4326)` on wards table
- Test ward assignment with 10 known lat/lng pairs before deploying trigger
- Prefer `GEOGRAPHY` type for distance (ST_DWithin on geography uses meters) vs `GEOMETRY` (uses degrees)

**Phase:** Ward Foundation (Phase 1 of build order)

---

## Pitfall 7: Resolution Photos Are Not Taken

**Description:** "Before/after" is the most powerful accountability feature — but field teams won't take resolution photos unless the workflow makes it trivially easy on a phone. Without after-photos, government can mark issues resolved without fixing them.

**Warning signs:**
- Resolution photos field is always blank
- Citizens recomplaining about the same location after resolution
- Field team says "I fixed it but I didn't have my phone"

**Prevention:**
- Resolution photo is optional in v1 — make it easy, not mandatory
- Mobile admin interface must open camera directly (no file picker — direct capture)
- When present, before/after comparison drives massive public trust — use it in comms

**Phase:** Government Workflow (Phase 3 of build order)

---

## Pitfall 8: Analytics Dashboard Is Built for You, Not GBA

**Description:** Developer-friendly dashboards (trend charts, heatmaps, time series) are not what government planners need. They need "which 10 wards have the most unresolved issues?" and "how many reports have we closed this month?" Everything else is noise.

**Warning signs:**
- GBA admin asks you to explain what a chart means
- Dashboard has 8 charts; only 2 get clicked
- GBA asks for the numbers in an email instead of opening the dashboard

**Prevention:**
- Build "Top 10 wards by unresolved count" as the first view — answer the #1 political question
- Show resolution rate by corporation (inter-corporation accountability)
- Trend chart is secondary — GBA planners care about NOW, not historical trajectory
- All numbers must be explainable in plain language: "Ward 42 has 23 open footpath complaints"

**Phase:** Export & Analytics (Phase 4 of build order)

---

## Pitfall 9: GBA Org Structure Changes Mid-Build

**Description:** BBMP was dissolved; GBA is new. The 5 corporation structure may be reorganized, renamed, or have responsibilities shifted before or after launch. Any hardcoded org structure in the codebase will require a migration under time pressure.

**Warning signs:**
- GBA announcement about administrative restructuring
- Corporation names in DB don't match official GBA nomenclature
- Admin user can't be assigned to their actual organization

**Prevention:**
- Organizations table is self-referential (already designed in ARCHITECTURE.md) — no hardcoded structure
- Seed organizations as data (SQL migration), not code constants
- Build admin UI to add/rename/reassign organizations without a code deploy
- Delay hardcoding corporation routing until GBA engagement confirms structure

**Phase:** Government Workflow (Phase 3 of build order)

---

## Pitfall 10: Soft Launch Generates Negative Press

**Description:** Launching with Walkaluru/GBA means the first 100 reports are public and will be covered by local press. If those first reports show Bengaluru's worst problems but show zero government response (all "Open"), the narrative becomes "government ignores citizens." This can damage the GBA relationship before it starts.

**Warning signs:**
- More than 48 hours of "Open" status on high-profile reports
- Press coverage before admin workflow is operational
- GBA not briefed on how to use the admin interface before launch

**Prevention:**
- Agree with GBA on a 2-week "shadow period" — reports collected but not public until workflow is set up
- Train at least 2 GBA admins before any public announcement
- Have Walkaluru seed 10–20 high-quality reports with known resolvable issues before public launch
- Pre-agree with GBA on a "launch week" SLA: all new reports acknowledged within 72 hours

**Phase:** Pre-launch (cuts across all phases)

---

*Pitfalls derived from: mySociety FixMyStreet deployment retrospectives, Code for America civic tech field guide, Karnataka e-governance documented failures, and civic tech community postmortems.*
