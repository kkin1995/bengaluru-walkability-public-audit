# Phase 3: Government Triage Workflow - Context

**Gathered:** 2026-05-25 (updated; original: 2026-03-14)
**Status:** Backend plans 03-01/03-02 need replanning for new scope; frontend plans 03-03/03-04 blocked on design team spec (see D-37 + specifics)

<domain>
## Phase Boundary

Nammadaari admins can move reports through a full 6-value status lifecycle (Open → Acknowledged → Assigned → In Progress → Resolved → Closed), assign reports to corporations for internal routing, attach resolution evidence (notes + mandatory after-photo), the public map reflects status changes with color-coded pins, and a new public single-report page (`/reports/[id]`) shows each report's full details plus the GBA bureaucratic and elected responsibility hierarchy derived from the report's ward.

**Critical scope change (2026-05-25 — GBA meeting outcome):**
GBA Urban Design Cell and IT Cell confirmed they cannot integrate another application (bandwidth constraints). There is NO government-facing admin portal. Administration is exclusively by the Nammadaari team via the existing admin UI. The "org assignment" feature is retained but serves Nammadaari's internal tracking only — not GBA routing.

Citizen submission flow, dedup logic, and analytics/export are NOT part of this phase.

</domain>

<decisions>
## Implementation Decisions

### GBA Meeting Outcome
- **D-01:** GBA will NOT integrate — Nammadaari team administers all reports. No government-facing admin portal.
- **D-02:** The revised Phase 3 goal: show citizens who is bureaucratically responsible for their ward, and give Nammadaari admins a full lifecycle + internal assignment workflow.

### Status Enum Migration
- **D-03:** 6-value status enum: `open → acknowledged → assigned → in_progress → resolved → closed`
- **D-04:** Rename existing DB values: `submitted → open`, `under_review → acknowledged`, `resolved → resolved` (kept). Add new values: `assigned`, `in_progress`, `closed`
- **D-05:** Migration: ALTER TYPE rename approach (not keep-old-plus-add-new) — cleaner, no legacy naming drift
- **D-06:** Free transitions — admins can jump any status (e.g., Open → Resolved directly); no enforced forward-only constraint
- **D-07:** Any admin (not super-admin only) can perform any status transition including Close

### Org Assignment (Internal Routing)
- **D-08:** Org assignment is kept for Nammadaari's internal routing — to track which corporation they're coordinating with
- **D-09:** Assigning a report to an organization automatically advances status to `assigned` — one action, not two
- **D-10:** Assignment UI lives on the report detail view only (`/admin/reports/[id]`) — not inline in the list view
- **D-11:** Org picker uses a hierarchical cascade (Corporation first, then Ward Office)
- **D-12:** Researcher to seed placeholder GBA org structure based on publicly available GBA 2025 information — explicitly temporary

### Resolution Evidence
- **D-13:** After-photo is **mandatory** when transitioning to `resolved` — cannot resolve without photo evidence
- **D-14:** After-photo is also **mandatory** when transitioning to `closed` — prevents skipping Resolved via free transitions with no evidence
- **D-15:** Resolution notes (plain text) are optional at both Resolved and Closed transitions
- **D-16:** Resolve/close uses a combined modal: one form captures status + optional notes + mandatory photo upload; single submit commits all
- **D-17:** Resolution notes are admin-only (not public)
- **D-18:** Resolution after-photo is **publicly visible** on the public single-report page when present

### GBA Hierarchy — Data Source
- **D-19:** All hierarchy data exists in `data/gba_wards_2025.geojson` — already partially loaded into `wards` table (currently: `id`, `ward_number`, `ward_name`, `corporation`, `boundary`)
- **D-20:** The 5 corporations are already stored as TEXT in `wards.corporation`: Central, North, East, South, West
- **D-21:** Add hierarchy columns to `wards` table via migration: `zone_name`, `ro_division`, `aro_sub_division`, `assembly_constituency`, `assembly_constituency_no` — backfilled from GeoJSON at migration time
- **D-22:** Corporation tagging on reports: auto-derived at query time via JOIN `reports → wards` on `ward_id`. No denormalized corporation column on reports table.

### GBA Hierarchy — Display
- **D-23:** Show both the full bureaucratic AND elected chains per report:
  - Bureaucratic: Ward → ARO Sub Division → RO Division → Zone → Corporation → GBA
  - Elected: Assembly Constituency (MLA territory) from ward's `ac` field
- **D-24:** Researcher task: find official designation titles at each bureaucratic level (e.g., "Ward Assistant Executive Engineer") — org structure/designations ONLY; do NOT store named individuals
- **D-25:** Display locations:
  - Admin report detail page: full hierarchy chain (both chains)
  - Public map popup: Corporation name + ward name + status + "Read More →" link
  - Public single-report page (`/reports/[id]`): full hierarchy + all report details

### Public Single-Report Page (`/reports/[id]`)
- **D-26:** New citizen-facing page — uses Direction-A design system (`globals.css`)
- **D-27:** Accessible via "Read More →" in map popup; also directly linkable (shareable URL)
- **D-28:** Page shows: report photo (full-size), category + severity + description, submission date + ward + corporation, status badge, status history timeline, full GBA hierarchy (both chains), after-photo + resolution notes (when resolved/closed), back-to-map navigation
- **D-29:** Status history for public page: extend `GET /api/reports/:id` response to include status history array (each entry: status value, changed_at timestamp) — OR add `GET /api/reports/:id/history`; researcher/planner to recommend

### Public Map Status Display
- **D-30:** Pin colors: **Red** = Open/Acknowledged/Assigned (all pre-InProgress), **Yellow/Amber** = In Progress, **Green** = Resolved/Closed
- **D-31:** Map popup adds: Corporation name + ward name + current status label + "Read More →" link to `/reports/[id]`
- **D-32:** After-photo shown on the public report page (not in popup — popup stays compact)
- **D-33:** Resolved/Closed reports stay on map indefinitely as green pins — positive evidence of action

### Admin UI (Phase 02.5 Design System)
- **D-34:** All new admin components use Direction-B primitives (Btn, Input, Select, Icon, CSS tokens from `admin.css`) — consistent with Phase 02.5 redesign. No Tailwind.
- **D-35:** Frontend plans 03-03 (admin frontend) and 03-04 (public frontend) are **BLOCKED on design team spec** — see `<specifics>` for the brief to provide to the design team
- **D-36:** Backend plans 03-01 (DB schema) and 03-02 (backend handlers) can proceed immediately without the design spec

### StatusBadge Extension
- **D-37:** Extend `STATUS_MAP` in `StatusBadge.tsx` to handle all 6 values: `open`, `acknowledged`, `assigned`, `in_progress`, `resolved`, `closed`
- **D-38:** New CSS tokens needed in `admin.css`: `--status-open`, `--status-acknowledged`, `--status-assigned`, `--status-in-progress`, `--status-closed` (+ `-bg` counterparts in both light + dark blocks)

### Phase Sequencing
- **D-39:** Phase 02.6 (Build Metadata & Version Stamping) ships first — small/fast; Phase 3 starts on a new git branch after 02.6 merges
- **D-40:** Phase 3 branch name: `feat/phase-03-government-triage` (created from `main` after 02.6 merges)

### Claude's Discretion
- Exact Postgres ENUM rename migration syntax (safest approach given live data)
- Admin detail page layout for status action buttons, org assignment, and hierarchy display panel
- StatusBadge color tone choices for each of the 6 values (semantically: open→info/teal, acknowledged→info/teal, assigned→warn/amber, in_progress→warn/amber, resolved→accent/green, closed→muted/grey — planner confirms)
- Resolution modal component details (upload progress, error states) — after design spec received
- Whether status history goes in existing `GET /api/reports/:id` or a new endpoint

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GBA Hierarchy Data
- `data/gba_wards_2025.geojson` — 369 wards with full hierarchy: Corporation, zone_name, RO_Division, ARO_Sub_Division, Assembly Constituency, population. **Source of truth for migration backfill (D-21).**
- `gba-369-wards-december-2025.kml` — Original KML; GeoJSON derived from this

### Existing DB Schema
- `backend/migrations/004_ward_boundaries.sql` — Wards table current schema (id, ward_number, ward_name, corporation, boundary). Migration 008 adds hierarchy columns here.
- `backend/migrations/006_ward_org_scoping.sql` — Org scoping additions to wards/reports

### Existing Backend (extend, do not replace)
- `backend/src/db/admin_queries.rs` — `update_report_status`; extend to add `resolve_report`, `assign_report_org`, status history queries
- `backend/src/handlers/admin.rs` — Admin handlers; extend + add resolve/assign routes
- `backend/src/models/report.rs` — `Report` DB struct + `ReportResponse`; add `resolution_photo_path`, `resolution_notes`, `assigned_org_id`

### Existing Frontend (extend, do not replace)
- `frontend/app/admin/components/StatusBadge.tsx` — Extend STATUS_MAP for 6 values; add CSS tokens to `admin.css`
- `frontend/app/admin/reports/[id]/page.tsx` — Existing detail view; add status action bar, org picker, hierarchy panel
- `frontend/app/map/page.tsx` — Public map; add status-based pin colors + "Read More" link in popup

### Design System
- `frontend/app/admin/admin.css` — Direction-B token layer; add new `--status-*` tokens
- `frontend/app/globals.css` — Direction-A tokens; public report page uses these
- `design-ref/primitives.jsx` — Prop API for all admin Direction-B primitives

### Project Context
- `.planning/PROJECT.md` — GBA engagement history and stakeholder path
- `.planning/ROADMAP.md` — Phase 3 success criteria and plan breakdown

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/db/admin_queries.rs::update_report_status` — extend, not replace; handles status + status_history insert in one transaction
- `frontend/app/admin/components/Btn.tsx` — Use for status action buttons and resolve modal submit
- `frontend/app/admin/components/Input.tsx` — Use for resolution notes textarea in resolve modal
- `frontend/app/admin/components/Select.tsx` — Use for org cascade picker (Corporation → Ward Office)
- `frontend/app/admin/components/Icon.tsx` — Use for action button icons
- `backend/migrations/` — Sequential SQL files (001–007 exist); Phase 3 schema in `008_workflow.sql`

### Established Patterns
- CSS custom properties via inline `style` objects — no Tailwind in admin components (Phase 02.5 pattern)
- `AppError` enum — all backend error paths; add validation for missing photo on Resolved/Closed
- DB model (`Report`) → Response struct (`ReportResponse`) separation — new fields need both
- `require_auth` middleware — all admin endpoints protected; new routes follow same pattern
- Multipart form handling — existing in `create_report`; resolution photo follows same pattern
- `status_history` table with `note` column — use for status timeline in public report page

### Integration Points
- `backend/migrations/008_workflow.sql` — rename enum values; add `resolution_photo_path`, `resolution_notes`, `assigned_org_id` to `reports`; add `zone_name`, `ro_division`, `aro_sub_division`, `assembly_constituency`, `assembly_constituency_no` to `wards`
- `backend/src/handlers/admin.rs` — add POST `/api/admin/reports/:id/resolve` (multipart), POST `/api/admin/reports/:id/assign-org` (JSON)
- `backend/src/handlers/reports.rs` (public) — extend `GET /api/reports/:id` to include status history + ward hierarchy; or add new endpoint
- `frontend/app/reports/[id]/page.tsx` — New public page (does not exist yet)
- `frontend/app/map/page.tsx` — Update popup to show corporation + "Read More →" link; update pin marker colors by status

### Note on Existing Plans
- **Plans 03-01 and 03-02** (already exist) do not include hierarchy column migration (D-21) or the public report API (D-29). These plans need replanning before execution.
- **Plans 03-03 and 03-04** do not yet exist — blocked on design team spec (D-35).

</code_context>

<specifics>
## Specific Ideas

### Design Team Brief — Admin Portal UI Changes (Phase 3)

All admin components use Direction-B: teal Console palette, JetBrains Mono, CSS custom properties via inline `style` objects. No Tailwind.

**1. Report Detail Page (`/admin/reports/[id]`) — 3 new sections to add:**

**A. Status Action Bar** — Contextual action buttons based on current status:
- `open` → "Acknowledge" button
- `acknowledged` → "Assign to Org" + "Mark In Progress" buttons
- `assigned` → "Mark In Progress" + "Resolve" buttons
- `in_progress` → "Resolve" button
- `resolved` → "Close" button
- All buttons use Direction-B `Btn` primitive; "Resolve"/"Close" open the modal (D-16)

**B. Org Assignment Section** — Two-level cascading select (Corporation → Ward Office):
- Shows currently assigned org or "Unassigned"
- "Assign" button triggers the cascade picker; uses Direction-B `Select` primitive
- Auto-advances status to `assigned` on save (D-09)

**C. GBA Hierarchy Panel** — Read-only info section for the report's ward:
- Bureaucratic chain: Ward → ARO Sub Division → RO Division → Zone → Corporation → GBA
- Elected chain: Assembly Constituency (e.g., "154 – Rajarajeshwarinagar")
- Design as structured label/value list or info card

**2. Resolve/Close Modal:**
- Title: "Resolve Report" or "Close Report"
- After-photo upload field — **mandatory** (clear required indicator; submit blocked without it)
- Resolution notes textarea — optional
- "Mark Resolved" / "Mark Closed" submit button + Cancel button
- Uses Direction-B: Input, Btn, Icon primitives

**3. StatusBadge — 6-value color spec needed:**
- `open` → info/teal (neutral, new arrival)
- `acknowledged` → info/teal (seen, not yet actioned)
- `assigned` → warm/amber (assigned to a team)
- `in_progress` → warn/amber (active work)
- `resolved` → accent/green (positive)
- `closed` → muted/grey (archived, final)
Design team to specify exact token mappings from Direction-B palette.

**4. Admin Reports List — add Corporation column:**
- Auto-derived from ward assignment (JOIN, no new reports column)
- Short names: Central / North / East / South / West

---

### Design Team Brief — Public Citizen UI Changes (Phase 3)

All public components use Direction-A (citizen design system, `globals.css`).

**5. Map Popup update** — Add to existing popup:
- Corporation name (e.g., "West Corporation")
- Ward name
- Current status badge
- "Read More →" text link → `/reports/[id]`

**6. Public Single-Report Page (`/reports/[id]`) — New page:**
- Report photo (large, full-width or dominant)
- Category + severity + description
- Submission date + ward name + corporation
- Status badge
- Status history timeline: e.g., "Open (Jan 12) → Acknowledged (Jan 15) → In Progress (Jan 20)"
- GBA Responsibility Hierarchy section:
  - Bureaucratic: Ward → ARO Sub Division → RO Division → Zone → Corporation → GBA (each level labeled with official designation)
  - Elected: Assembly Constituency (MLA territory)
- Resolution section (only when resolved/closed): after-photo + resolution notes
- Back-to-map link

**7. Map pin colors by status:**
- Red: Open, Acknowledged, Assigned
- Yellow/Amber: In Progress
- Green: Resolved, Closed

---

### GBA Data Available in Repo (for design reference)
`data/gba_wards_2025.geojson` properties per ward: `Corporation`, `zone_name`, `RO_Division`, `ARO_ Sub Division`, `ac` (Assembly Constituency name), `ac_no`. All 369 wards covered across 5 corporations and 10 zones.

</specifics>

<deferred>
## Deferred Ideas

- **GBA-facing admin portal** — government-login portal for GBA staff. Deferred indefinitely pending renewed GBA engagement.
- **Named officer lookup** — Displaying current named individuals at each hierarchy level changes too frequently; deferred to future content management phase.
- **SMS/WhatsApp notifications to GBA officers** — Deferred to post-launch based on GBA requirements.
- **Report social sharing** — Share to WhatsApp/Twitter with pre-filled text. Deferred to polish phase.

</deferred>

---

*Phase: 03-government-triage-workflow*
*Context gathered: 2026-05-25 (updated from 2026-03-14)*
