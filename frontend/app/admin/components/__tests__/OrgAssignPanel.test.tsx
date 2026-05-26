/**
 * Tests for frontend/app/admin/components/OrgAssignPanel.tsx
 *
 * Requirements covered:
 *   WFLOW-03  — Org assignment: admin assigns a report to an organization
 *   D-08      — reports.assigned_org_id FK set by assign handler
 *   D-09      — Cascade picker: Corporation → Ward Office
 *   D-10      — OrgAssignPanel disables Save when no corporation is selected
 *   D-11      — Ward-office tier filtered by parent corporation
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrgAssignPanel } from "../OrgAssignPanel";
import type { AdminReport, Organization } from "../../lib/adminApi";
import * as adminApi from "../../lib/adminApi";

jest.mock("../../lib/adminApi", () => ({
  ...jest.requireActual("../../lib/adminApi"),
  listOrganizations: jest.fn(),
  assignReportOrg: jest.fn(),
}));

const mockListOrgs = adminApi.listOrganizations as jest.MockedFunction<typeof adminApi.listOrganizations>;
const mockAssignOrg = adminApi.assignReportOrg as jest.MockedFunction<typeof adminApi.assignReportOrg>;

function makeReport(overrides: Partial<AdminReport> = {}): AdminReport {
  return {
    id: "test-report-001",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    image_path: "test.jpg",
    image_url: "http://localhost:3001/uploads/test.jpg",
    latitude: 12.97,
    longitude: 77.59,
    category: "damaged_footpath",
    severity: "high",
    description: null,
    submitter_name: null,
    submitter_contact: null,
    status: "open",
    location_source: "manual",
    ward_name: "Shivajinagar",
    resolution_photo_url: null,
    resolution_notes: null,
    assigned_org_id: null,
    ...overrides,
  };
}

const CORP_A: Organization = {
  id: "corp-a",
  name: "Bengaluru West Corporation",
  org_type: "corporation",
  parent_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const CORP_B: Organization = {
  id: "corp-b",
  name: "Bengaluru East Corporation",
  org_type: "corporation",
  parent_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const WARD_OFFICE_A1: Organization = {
  id: "wo-a1",
  name: "Shivajinagar Ward Office",
  org_type: "ward_office",
  parent_id: "corp-a",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const WARD_OFFICE_A2: Organization = {
  id: "wo-a2",
  name: "Cubbon Park Ward Office",
  org_type: "ward_office",
  parent_id: "corp-a",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListOrgs.mockResolvedValue([CORP_A, CORP_B, WARD_OFFICE_A1, WARD_OFFICE_A2]);
});

// ---------------------------------------------------------------------------
// WFLOW-03 / D-09 — Corporation dropdown rendered from org list
// ---------------------------------------------------------------------------

describe("WFLOW-03 / D-09 — OrgAssignPanel: corporation dropdown rendered", () => {
  it("renders a select element populated with corporation names after clicking Assign", async () => {
    render(
      <OrgAssignPanel
        report={makeReport()}
        onAssigned={jest.fn()}
      />
    );

    // Should start in view mode with "No organisation assigned"
    expect(screen.getByTestId("org-status")).toHaveTextContent("No organisation assigned");

    // Click Assign to enter edit mode
    fireEvent.click(screen.getByText("Assign"));

    // Wait for orgs to load
    await waitFor(() => {
      expect(screen.getByTestId("org-corp-select")).toBeInTheDocument();
    });

    // Corporation names should be in the select
    expect(screen.getByText("Bengaluru West Corporation")).toBeInTheDocument();
    expect(screen.getByText("Bengaluru East Corporation")).toBeInTheDocument();
  });

  it("does NOT render ward-office select when no corporation is selected", async () => {
    render(
      <OrgAssignPanel
        report={makeReport()}
        onAssigned={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Assign"));

    await waitFor(() => {
      expect(screen.getByTestId("org-corp-select")).toBeInTheDocument();
    });

    // Ward office select should not be present when no corp selected
    expect(screen.queryByTestId("org-ward-office-select")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// WFLOW-03 / D-09 — Ward office filtered by corporation selection
// ---------------------------------------------------------------------------

describe("WFLOW-03 / D-09 — OrgAssignPanel: ward office filtered by corporation", () => {
  it("shows ward-office sub-picker only when corporation is selected and ward offices exist", async () => {
    render(
      <OrgAssignPanel
        report={makeReport()}
        onAssigned={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Assign"));

    await waitFor(() => {
      expect(screen.getByTestId("org-corp-select")).toBeInTheDocument();
    });

    // Select Corp A (which has ward offices)
    fireEvent.change(screen.getByTestId("org-corp-select"), {
      target: { value: "corp-a" },
    });

    // Ward office select should appear with the 2 ward offices under corp-a
    await waitFor(() => {
      expect(screen.getByTestId("org-ward-office-select")).toBeInTheDocument();
    });
    expect(screen.getByText("Shivajinagar Ward Office")).toBeInTheDocument();
    expect(screen.getByText("Cubbon Park Ward Office")).toBeInTheDocument();
  });

  it("clears ward office selection when corporation changes", async () => {
    render(
      <OrgAssignPanel
        report={makeReport()}
        onAssigned={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Assign"));

    await waitFor(() => {
      expect(screen.getByTestId("org-corp-select")).toBeInTheDocument();
    });

    // Select Corp A
    fireEvent.change(screen.getByTestId("org-corp-select"), {
      target: { value: "corp-a" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("org-ward-office-select")).toBeInTheDocument();
    });

    // Select a ward office
    fireEvent.change(screen.getByTestId("org-ward-office-select"), {
      target: { value: "wo-a1" },
    });

    // Now change to Corp B (has no ward offices) — ward office picker should disappear
    fireEvent.change(screen.getByTestId("org-corp-select"), {
      target: { value: "corp-b" },
    });

    // Ward office select should be gone (Corp B has no ward offices in test data)
    await waitFor(() => {
      expect(screen.queryByTestId("org-ward-office-select")).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// WFLOW-03 / D-10 — Save button disabled without corporation selected
// ---------------------------------------------------------------------------

describe("WFLOW-03 / D-10 — OrgAssignPanel: save button disabled without corporation", () => {
  it("Save button is disabled when no corporation has been selected", async () => {
    render(
      <OrgAssignPanel
        report={makeReport()}
        onAssigned={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Assign"));

    await waitFor(() => {
      expect(screen.getByTestId("org-save")).toBeInTheDocument();
    });

    expect(screen.getByTestId("org-save")).toBeDisabled();
  });

  it("Save button becomes enabled after a corporation is selected", async () => {
    render(
      <OrgAssignPanel
        report={makeReport()}
        onAssigned={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Assign"));

    await waitFor(() => {
      expect(screen.getByTestId("org-corp-select")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("org-corp-select"), {
      target: { value: "corp-a" },
    });

    expect(screen.getByTestId("org-save")).not.toBeDisabled();
  });

  it("calls assignReportOrg with the selected corporation id when Save is clicked", async () => {
    const onAssigned = jest.fn();
    const updatedReport = makeReport({ assigned_org_id: "corp-a", status: "assigned" });
    mockAssignOrg.mockResolvedValue(updatedReport);

    render(
      <OrgAssignPanel
        report={makeReport()}
        onAssigned={onAssigned}
      />
    );

    fireEvent.click(screen.getByText("Assign"));

    await waitFor(() => {
      expect(screen.getByTestId("org-corp-select")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("org-corp-select"), {
      target: { value: "corp-a" },
    });

    fireEvent.click(screen.getByTestId("org-save"));

    await waitFor(() => {
      expect(mockAssignOrg).toHaveBeenCalledWith("test-report-001", "corp-a");
    });
    expect(onAssigned).toHaveBeenCalledWith(updatedReport);
  });
});
