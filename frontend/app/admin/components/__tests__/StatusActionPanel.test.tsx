/**
 * Tests for frontend/app/admin/components/StatusActionPanel.tsx
 *
 * Requirements covered:
 *   WFLOW-01  — 6-value status lifecycle action button bar
 *   D-37      — Status-conditional action panel: buttons shown depend on current status
 *   D-38      — "Closed" panel shows locked/read-only state (no further actions)
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatusActionPanel } from "../StatusActionPanel";
import type { AdminReport } from "../../lib/adminApi";

function makeReport(status: string): AdminReport {
  return {
    id: "test-report-id-001",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    image_path: "test.jpg",
    image_url: "http://localhost:3001/uploads/test.jpg",
    latitude: 12.97,
    longitude: 77.59,
    category: "damaged_footpath",
    severity: "high",
    description: "Test description",
    submitter_name: null,
    submitter_contact: null,
    status,
    location_source: "manual",
    ward_name: "Shivajinagar",
    resolution_photo_url: null,
    resolution_notes: null,
    assigned_org_id: null,
  };
}

const noop = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// WFLOW-01 / D-37 — open → acknowledge button
// ---------------------------------------------------------------------------

describe('WFLOW-01 / D-37 — StatusActionPanel: status="open" shows Acknowledge button', () => {
  it('renders an "Acknowledge" button when status is "open"', () => {
    render(
      <StatusActionPanel
        report={makeReport("open")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    expect(screen.getByTestId("action-acknowledge")).toBeInTheDocument();
    expect(screen.getByText("Acknowledge")).toBeInTheDocument();
  });

  it('clicking Acknowledge calls onStatusChange with "acknowledged"', () => {
    const onStatusChange = jest.fn().mockResolvedValue(undefined);
    render(
      <StatusActionPanel
        report={makeReport("open")}
        onStatusChange={onStatusChange}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    fireEvent.click(screen.getByTestId("action-acknowledge"));
    expect(onStatusChange).toHaveBeenCalledWith("acknowledged");
  });

  it('does NOT render a Resolve or Close button when status is "open"', () => {
    render(
      <StatusActionPanel
        report={makeReport("open")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    expect(screen.queryByTestId("action-resolve")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-close")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// WFLOW-01 / D-37 — acknowledged → assign + mark in progress buttons
// ---------------------------------------------------------------------------

describe('WFLOW-01 / D-37 — StatusActionPanel: status="acknowledged" shows Assign + Mark In Progress', () => {
  it('renders an "Assign to organisation" button when status is "acknowledged"', () => {
    render(
      <StatusActionPanel
        report={makeReport("acknowledged")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    expect(screen.getByTestId("action-assign")).toBeInTheDocument();
    expect(screen.getByText("Assign to organisation")).toBeInTheDocument();
  });

  it('renders a "Mark as in progress" button when status is "acknowledged"', () => {
    render(
      <StatusActionPanel
        report={makeReport("acknowledged")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    expect(screen.getByTestId("action-mark-in-progress")).toBeInTheDocument();
    expect(screen.getByText("Mark as in progress")).toBeInTheDocument();
  });

  it('clicking "Assign to organisation" calls onAssignClick', () => {
    const onAssignClick = jest.fn();
    render(
      <StatusActionPanel
        report={makeReport("acknowledged")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={onAssignClick}
        onCloseClick={noop}
      />
    );
    fireEvent.click(screen.getByTestId("action-assign"));
    expect(onAssignClick).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// WFLOW-01 / D-37 — assigned → mark in progress + resolve buttons
// ---------------------------------------------------------------------------

describe('WFLOW-01 / D-37 — StatusActionPanel: status="assigned" shows Mark In Progress + Resolve', () => {
  it('renders a "Mark as in progress" button when status is "assigned"', () => {
    render(
      <StatusActionPanel
        report={makeReport("assigned")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    expect(screen.getByTestId("action-mark-in-progress")).toBeInTheDocument();
  });

  it('renders a "Resolve" button when status is "assigned"', () => {
    render(
      <StatusActionPanel
        report={makeReport("assigned")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    expect(screen.getByTestId("action-resolve")).toBeInTheDocument();
    expect(screen.getByText("Resolve")).toBeInTheDocument();
  });

  it('clicking Resolve calls onResolveClick (does not call onStatusChange directly)', () => {
    const onResolveClick = jest.fn();
    const onStatusChange = jest.fn().mockResolvedValue(undefined);
    render(
      <StatusActionPanel
        report={makeReport("assigned")}
        onStatusChange={onStatusChange}
        onResolveClick={onResolveClick}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    fireEvent.click(screen.getByTestId("action-resolve"));
    expect(onResolveClick).toHaveBeenCalled();
    expect(onStatusChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// WFLOW-01 / D-37 — in_progress → resolve button
// ---------------------------------------------------------------------------

describe('WFLOW-01 / D-37 — StatusActionPanel: status="in_progress" shows Resolve', () => {
  it('renders a "Resolve" button when status is "in_progress"', () => {
    render(
      <StatusActionPanel
        report={makeReport("in_progress")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    expect(screen.getByTestId("action-resolve")).toBeInTheDocument();
  });

  it('does NOT render an "Acknowledge" or "Assign" button when status is "in_progress"', () => {
    render(
      <StatusActionPanel
        report={makeReport("in_progress")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    expect(screen.queryByTestId("action-acknowledge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-assign")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// WFLOW-01 / D-37 — resolved → close button
// ---------------------------------------------------------------------------

describe('WFLOW-01 / D-37 — StatusActionPanel: status="resolved" shows Close', () => {
  it('renders a "Close report" button when status is "resolved"', () => {
    render(
      <StatusActionPanel
        report={makeReport("resolved")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    expect(screen.getByTestId("action-close")).toBeInTheDocument();
    expect(screen.getByText("Close report")).toBeInTheDocument();
  });

  it('clicking Close report calls onCloseClick', () => {
    const onCloseClick = jest.fn();
    render(
      <StatusActionPanel
        report={makeReport("resolved")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={onCloseClick}
      />
    );
    fireEvent.click(screen.getByTestId("action-close"));
    expect(onCloseClick).toHaveBeenCalled();
  });

  it('does NOT render Acknowledge, Assign, or Mark In Progress when resolved', () => {
    render(
      <StatusActionPanel
        report={makeReport("resolved")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    expect(screen.queryByTestId("action-acknowledge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-assign")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-mark-in-progress")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// WFLOW-01 / D-38 — closed → locked panel (no action buttons)
// ---------------------------------------------------------------------------

describe('WFLOW-01 / D-38 — StatusActionPanel: status="closed" shows locked panel', () => {
  it('renders a read-only locked panel when status is "closed"', () => {
    render(
      <StatusActionPanel
        report={makeReport("closed")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    expect(screen.getByText("This report is closed.")).toBeInTheDocument();
  });

  it('does NOT render any action buttons when status is "closed"', () => {
    render(
      <StatusActionPanel
        report={makeReport("closed")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    expect(screen.queryByTestId("action-acknowledge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-assign")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-resolve")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-close")).not.toBeInTheDocument();
  });

  it('locked panel is accessible — has appropriate aria attribute for read-only state', () => {
    render(
      <StatusActionPanel
        report={makeReport("closed")}
        onStatusChange={noop}
        onResolveClick={noop}
        onAssignClick={noop}
        onCloseClick={noop}
      />
    );
    const lockedPanel = screen.getByText("This report is closed.").closest("[aria-disabled]");
    expect(lockedPanel).toHaveAttribute("aria-disabled", "true");
  });
});
