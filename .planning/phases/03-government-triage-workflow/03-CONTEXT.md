# Phase 3: Government Triage Workflow - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

GBA admins can move reports through a full status lifecycle (Open → Acknowledged → Assigned → In Progress → Resolved → Closed), assign reports to the correct corporation or ward office, attach resolution evidence (notes + mandatory after-photo), and the public map reflects every status change with color-coded pins.

Citizen submission flow, dedup logic, and analytics/export are NOT part of this phase.

</domain>

<decisions>
## Implementation Decisions

### Status Enum Migration
- Rename existing DB values: `submitted → open`, `under_review → acknowledged`, `resolved → resolved` (kept)
- Add new values: `assigned`, `in_progress`, `closed`
- Final enum order: `open → acknowledged → assigned → in_progress → resolved → closed`
- Migration: ALTER TYPE rename approach (not keep-old-plus-add-new) — cleaner, no legacy naming drift
- Any admin (not super-admin only) can perform any status transition including Close
- Free transitions allowed — admins can jump statuses (e.g., Open → Resolved directly); no enforced forward-only constraint

### Org Assignment
- Assigning a report to an organization automatically advances status to `assigned` — one action, not two
- Assignment UI lives on the report detail view only (`/admin/reports/[id]`) — not inline in the list view
- Org picker uses a hierarchical tree selector (cascading selects: Corporation first, then Ward Office)
- Researcher to seed placeholder GBA org structure based on publicly available GBA 2025 information — this will be replaced when GBA engagement is confirmed

### Resolution Evidence
- After-photo is **mandatory** when transitioning to `resolved` — cannot resolve without photo evidence
- After-photo is also **mandatory** when transitioning to `closed` — prevents skipping Resolved via free transitions with no evidence
- Resolution notes (plain text) are optional at both Resolved and Closed transitions
- Resolve/close action uses a combined modal: one form captures status confirmation + optional notes + mandatory photo upload; single submit commits all
- Resolution notes are admin-only (not public)
- Resolution after-photo is **publicly visible** on the map popup when present

### Public Map Status Display
- Pin colors: **Red** = Open (all pre-resolved statuses: open, acknowledged, assigned, in_progress), **Yellow/Amber** = In Progress, **Green** = Resolved/Closed
  - Publicly, three states are meaningful: Open (red), In Progress (yellow), Resolved (green)
- Map popup adds: current status label + after-photo thumbnail when available
- Resolved/closed reports stay on the map indefinitely as green pins — positive evidence of government action

### Claude's Discretion
- Exact Postgres ENUM rename migration syntax (researcher/planner to decide safest approach given live data)
- Admin detail page layout for the new status action buttons and org assignment section
- Exact cascading select component for org hierarchy
- Resolution modal UX details (upload progress, error states)
- Which "in-between" statuses (acknowledged, assigned) show as which color — Red or Amber — on the public map (only Open/InProgress/Resolved have distinct colors per requirements MAP-01)

</decisions>

<specifics>
## Specific Ideas

- After-photo mandatory for Resolved AND Closed — the photo requirement on Closed prevents an admin from using free transitions to skip Resolved (go Open → Closed) without uploading evidence
- Researcher should find GBA corporation names and ward office structure from public sources as placeholder seed data — this is explicitly temporary until GBA onboarding
- User wants the cascading org selector even though it's more complex — worth building correctly given the GBA hierarchy depth

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/db/admin_queries.rs::update_report_status`: existing function that updates status + inserts into status_history — will be extended, not replaced
- `backend/src/handlers/admin.rs::admin_update_report_status`: existing PATCH endpoint — extend to handle new status values and resolution photo/notes
- `frontend/app/admin/components/StatusBadge.tsx`: existing component with status config map — add new status values (acknowledged, assigned, in_progress, closed) with appropriate colors
- `backend/src/migrations/`: sequential SQL migration files (`001–007`) — Phase 3 schema goes in `008_workflow.sql`
- `backend/src/models/report.rs`: `Report` DB struct and `ReportResponse` — add `resolution_photo`, `resolution_notes`, `assigned_org_id` fields
- `frontend/app/admin/reports/[id]/page.tsx`: existing detail view — location for org assignment section and status action buttons
- `frontend/app/map/`: existing public map component — add color-coded pins and popup status display

### Established Patterns
- `AppError` enum: all error paths return `AppError` — add validation error for missing photo on Resolved/Closed transitions
- DB model → Response struct separation: new fields on `reports` need both `Report` DB struct and `ReportResponse` serialization updates
- `require_auth` middleware: all admin endpoints protected — new status/assignment endpoints follow same pattern
- Multipart form handling: existing in `create_report` for photo uploads — resolution photo upload follows same pattern
- `status_history` table already has `note` column — resolution notes stored here or on `reports` directly (researcher to advise)

### Integration Points
- `backend/migrations/008_workflow.sql`: rename enum values, add `resolution_photo_path`, `resolution_notes`, `assigned_org_id` columns to `reports`
- `backend/src/handlers/admin.rs`: extend status update handler to validate photo on Resolved/Closed, handle multipart for resolution photo
- `backend/src/db/admin_queries.rs`: update `update_report_status` to handle auto-assign org → status advancement
- `frontend/app/admin/reports/[id]/`: add org assignment section with hierarchical org picker
- `frontend/app/map/`: update map pins to use status-based colors (red/yellow/green), update popup to show status + resolution photo
- `frontend/app/admin/components/StatusBadge.tsx`: add 3 new status values with colors

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-government-triage-workflow*
*Context gathered: 2026-03-14*
