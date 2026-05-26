/**
 * Wave 0 test scaffold for frontend/app/admin/components/OrgAssignPanel.tsx
 *
 * Requirements covered:
 *   WFLOW-03  — Org assignment: admin assigns a report to an organization
 *   D-08      — reports.assigned_org_id FK set by assign handler
 *   D-09      — Cascade picker: GBA → Corporation → Ward Office (2-level for Phase 03)
 *   D-10      — OrgAssignPanel disables Save when no corporation is selected
 *   D-11      — Ward-office tier is absent for Phase 03 (GBA not finalized); picker shows corps only
 *
 * This file is a Wave 0 scaffold — all describe blocks use describe.skip.
 * Plan 03-03 executor must:
 *   1. Create frontend/app/admin/components/OrgAssignPanel.tsx
 *   2. Remove describe.skip wrappers and implement the assertions
 *   3. Run `npm test -- --watchAll=false OrgAssignPanel` to confirm green
 *
 * Implementation notes for plan 03-03:
 *   - OrgAssignPanel receives props: reportId, currentOrgId, onSave, orgs (Organization[])
 *   - orgs prop comes from GET /api/admin/organizations — mock via jest.spyOn(global, 'fetch')
 *   - Corporation dropdown populated from orgs.filter(o => o.org_type === 'corporation')
 *   - Ward office tier not rendered in Phase 03 (orgs has no ward_office rows in seed data)
 *   - Save calls adminApi.assignOrg(reportId, orgId)
 */

import React from "react";

// Component is not yet implemented — import is intentionally commented out.
// import OrgAssignPanel from "../OrgAssignPanel";

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// WFLOW-03 / D-09 — Corporation dropdown rendered from org list
// ---------------------------------------------------------------------------

describe.skip("WFLOW-03 / D-09 — OrgAssignPanel: corporation dropdown rendered", () => {
  it("renders a select/listbox element populated with corporation names", () => {
    // TODO (plan 03-03): render <OrgAssignPanel orgs={[...5 corporations...]} ... />
    // and assert all 5 Bengaluru * Corporation entries appear in the picker
  });

  it("does NOT render ward-office entries when no ward_office orgs are in the list", () => {
    // TODO (plan 03-03): pass orgs with only corporation entries,
    // confirm no "Ward Office" label or tier is visible (D-11 — Phase 03 scope)
  });
});

// ---------------------------------------------------------------------------
// WFLOW-03 / D-09 — Ward office filtered by corporation selection
// ---------------------------------------------------------------------------

describe.skip("WFLOW-03 / D-09 — OrgAssignPanel: ward office filtered by corporation", () => {
  it("shows ward-office sub-picker only when corporation is selected and ward offices exist", () => {
    // TODO (plan 03-03): pass orgs with 1 corporation + 2 ward offices under that corp,
    // select the corporation from the picker, and assert the ward-office sub-picker appears
    // with the correct 2 entries filtered by parent_id === corporation.id
  });

  it("clears ward office selection when corporation changes", () => {
    // TODO (plan 03-03): select corp A (has ward offices), select a ward office,
    // then change corporation to corp B — ward office selection must reset to none
  });
});

// ---------------------------------------------------------------------------
// WFLOW-03 / D-10 — Save button disabled without corporation selected
// ---------------------------------------------------------------------------

describe.skip("WFLOW-03 / D-10 — OrgAssignPanel: save button disabled without corporation", () => {
  it("Save button is disabled when no corporation has been selected", () => {
    // TODO (plan 03-03): render panel with initial orgId=undefined,
    // assert getByRole('button', { name: /save/i }).toBeDisabled()
  });

  it("Save button becomes enabled after a corporation is selected", () => {
    // TODO (plan 03-03): select a corporation from the dropdown,
    // assert Save button is enabled (not disabled)
  });

  it("calls adminApi.assignOrg with the selected corporation id when Save is clicked", () => {
    // TODO (plan 03-03): select a corporation, click Save,
    // assert adminApi.assignOrg was called with (reportId, selectedCorpId)
  });
});
