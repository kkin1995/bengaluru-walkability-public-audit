/**
 * Wave 0 test scaffold for frontend/app/admin/components/StatusActionPanel.tsx
 *
 * Requirements covered:
 *   WFLOW-01  — 6-value status lifecycle action button bar
 *   D-37      — Status-conditional action panel: buttons shown depend on current status
 *   D-38      — "Closed" panel shows locked/read-only state (no further actions)
 *
 * This file is a Wave 0 scaffold — all describe blocks use describe.skip.
 * Plan 03-03 executor must:
 *   1. Create frontend/app/admin/components/StatusActionPanel.tsx
 *   2. Remove describe.skip wrappers and implement the assertions
 *   3. Run `npm test -- --watchAll=false StatusActionPanel` to confirm green
 *
 * Implementation notes for plan 03-03:
 *   - StatusActionPanel receives props: reportId, currentStatus, onStatusChange
 *   - onStatusChange is called with the new status string when a button is clicked
 *   - Button labels must match 03-UI-SPEC.md §copywriting contract exactly
 *   - adminApi calls should be mocked via jest.mock("@/app/lib/adminApi")
 *   - Resolved/Closed transitions open the ResolveModal before calling adminApi
 *
 * Button contract per 03-UI-SPEC.md:
 *   open        → "Acknowledge" (→ acknowledged)
 *   acknowledged → "Assign" (→ assigned), "Mark In Progress" (→ in_progress)
 *   assigned    → "Mark In Progress" (→ in_progress), "Resolve" (opens modal → resolved)
 *   in_progress → "Resolve" (opens modal → resolved)
 *   resolved    → "Close" (opens modal → closed)
 *   closed      → locked panel, no action buttons
 */

import React from "react";

// Component is not yet implemented — import is intentionally commented out.
// import StatusActionPanel from "../StatusActionPanel";

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// WFLOW-01 / D-37 — open → acknowledge button
// ---------------------------------------------------------------------------

describe.skip('WFLOW-01 / D-37 — StatusActionPanel: status="open" shows Acknowledge button', () => {
  it('renders an "Acknowledge" button when status is "open"', () => {
    // TODO (plan 03-03): render <StatusActionPanel reportId="..." currentStatus="open" ... />
    // and assert getByRole('button', { name: /acknowledge/i }) is in the document
  });

  it('clicking Acknowledge calls onStatusChange with "acknowledged"', () => {
    // TODO (plan 03-03): click the Acknowledge button,
    // assert onStatusChange was called with "acknowledged"
  });

  it('does NOT render a Resolve or Close button when status is "open"', () => {
    // TODO (plan 03-03): assert queryByRole('button', { name: /resolve/i }) is null
    // and queryByRole('button', { name: /close/i }) is null
  });
});

// ---------------------------------------------------------------------------
// WFLOW-01 / D-37 — acknowledged → assign + mark in progress buttons
// ---------------------------------------------------------------------------

describe.skip('WFLOW-01 / D-37 — StatusActionPanel: status="acknowledged" shows Assign + Mark In Progress', () => {
  it('renders an "Assign" button when status is "acknowledged"', () => {
    // TODO (plan 03-03): render with currentStatus="acknowledged",
    // assert getByRole('button', { name: /assign/i }) is in the document
  });

  it('renders a "Mark In Progress" button when status is "acknowledged"', () => {
    // TODO (plan 03-03): assert getByRole('button', { name: /mark in progress/i }) is present
  });

  it('clicking Assign transitions status to "assigned"', () => {
    // TODO (plan 03-03): click Assign button, assert onStatusChange("assigned")
  });
});

// ---------------------------------------------------------------------------
// WFLOW-01 / D-37 — assigned → mark in progress + resolve buttons
// ---------------------------------------------------------------------------

describe.skip('WFLOW-01 / D-37 — StatusActionPanel: status="assigned" shows Mark In Progress + Resolve', () => {
  it('renders a "Mark In Progress" button when status is "assigned"', () => {
    // TODO (plan 03-03): render with currentStatus="assigned",
    // assert getByRole('button', { name: /mark in progress/i }) is in the document
  });

  it('renders a "Resolve" button when status is "assigned"', () => {
    // TODO (plan 03-03): assert getByRole('button', { name: /resolve/i }) is present
  });

  it('clicking Resolve opens the ResolveModal (does not call adminApi directly)', () => {
    // TODO (plan 03-03): click Resolve, assert ResolveModal is visible
    // (e.g. getByRole('dialog') or getByText(/resolution photo/i) appears)
  });
});

// ---------------------------------------------------------------------------
// WFLOW-01 / D-37 — in_progress → resolve button
// ---------------------------------------------------------------------------

describe.skip('WFLOW-01 / D-37 — StatusActionPanel: status="in_progress" shows Resolve', () => {
  it('renders a "Resolve" button when status is "in_progress"', () => {
    // TODO (plan 03-03): render with currentStatus="in_progress",
    // assert getByRole('button', { name: /resolve/i }) is in the document
  });

  it('does NOT render an "Acknowledge" or "Assign" button when status is "in_progress"', () => {
    // TODO (plan 03-03): assert acknowledge and assign buttons are absent
  });
});

// ---------------------------------------------------------------------------
// WFLOW-01 / D-37 — resolved → close button
// ---------------------------------------------------------------------------

describe.skip('WFLOW-01 / D-37 — StatusActionPanel: status="resolved" shows Close', () => {
  it('renders a "Close" button when status is "resolved"', () => {
    // TODO (plan 03-03): render with currentStatus="resolved",
    // assert getByRole('button', { name: /close/i }) is in the document
  });

  it('clicking Close opens the ResolveModal for the closing photo + notes', () => {
    // TODO (plan 03-03): click Close, assert ResolveModal becomes visible
  });

  it('does NOT render Acknowledge, Assign, or Mark In Progress when resolved', () => {
    // TODO (plan 03-03): assert these three buttons are all absent
  });
});

// ---------------------------------------------------------------------------
// WFLOW-01 / D-38 — closed → locked panel (no action buttons)
// ---------------------------------------------------------------------------

describe.skip('WFLOW-01 / D-38 — StatusActionPanel: status="closed" shows locked panel', () => {
  it('renders a read-only locked panel when status is "closed"', () => {
    // TODO (plan 03-03): render with currentStatus="closed",
    // assert a locked/completed indicator (e.g. getByText(/closed/i) or getByTestId('locked-panel'))
    // is in the document and no action buttons are present
  });

  it('does NOT render any action buttons when status is "closed"', () => {
    // TODO (plan 03-03): assert queryByRole('button', { name: /acknowledge|assign|resolve|close/i })
    // returns null (no actionable buttons in closed state)
  });

  it('locked panel is accessible — has appropriate aria attribute for read-only state', () => {
    // TODO (plan 03-03): assert the locked panel element carries aria-disabled="true"
    // or aria-label containing "closed" / "no further actions"
  });
});
