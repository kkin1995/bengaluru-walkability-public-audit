---
title: Auto-populate assigned_org_id from ward on report submit
type: feature
priority: low
milestone: next
created: 2026-05-31
---

## What

When a report is submitted for a ward that maps to a corporation, auto-set
`reports.assigned_org_id = wards.org_id` at insert time.

Currently `assigned_org_id` is manually set by admins. The ward's corporation
is already visible in the GBA hierarchy, making the manual assignment step
redundant in most cases.

## Options

**A — Auto-populate on submit (preferred):** Set `assigned_org_id = ward.org_id`
in the `insert_report` DB function. Admin can still override via OrgAssignPanel.
Status does NOT auto-advance to "assigned" (since no human deliberately chose it).

**B — One-click fill:** Add a "Use ward corporation" button in OrgAssignPanel
that fills in the ward's org without a full manual cascade picker flow.

## Why deferred

CONTEXT D-08 designed assignment as explicit admin tracking ("which corp are we
coordinating with"). Auto-population changes the semantic. Scoping for next milestone
once the v1.0 UAT is complete.

## Related

- backend/src/db/admin_queries.rs — assign_report_org (manual path, ~line 724)
- frontend/app/admin/components/OrgAssignPanel.tsx — the picker UI
- CONTEXT D-08, D-09, D-22
