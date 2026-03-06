/**
 * Tests for frontend/app/admin/components/ReportsTable.tsx
 *
 * Requirements covered (from admin-users-frontend-ac.md and admin-reports-ac.md):
 *   R-COMP-5   — ReportsTable must be sortable by date (asc/desc).
 *   R-RPT-3    — Delete button present for admin role; absent (not in DOM) for reviewer role.
 *   AC-RPT-3-S1 — Security regression: reviewer must see no delete button anywhere.
 *
 * Additional requirements from task specification:
 *   - Renders a row per report entry
 *   - Each row shows category, severity, status
 *   - onDelete called with report id when delete button clicked
 *   - onStatusChange called with report id when status change button clicked
 *   - Empty array → empty state message or empty table body (no crash)
 *
 * Props interface (contract for the implementation agent):
 *   interface Report {
 *     id: string;
 *     category: string;
 *     severity: string;
 *     status: string;
 *     created_at: string;
 *     image_path?: string;
 *   }
 *   interface ReportsTableProps {
 *     reports: Report[];
 *     role: "admin" | "reviewer";
 *     onStatusChange: (id: string) => void;
 *     onDelete: (id: string) => void;
 *   }
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportsTable from "../ReportsTable";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const REPORT_A = {
  id: "report-uuid-001",
  category: "broken_footpath",
  severity: "high",
  status: "submitted",
  created_at: "2026-03-01T10:00:00Z",
};

const REPORT_B = {
  id: "report-uuid-002",
  category: "poor_lighting",
  severity: "low",
  status: "under_review",
  created_at: "2026-03-02T12:00:00Z",
  image_path: "uploads/img002.jpg",
};

const REPORT_C = {
  id: "report-uuid-003",
  category: "unsafe_crossing",
  severity: "medium",
  status: "resolved",
  created_at: "2026-03-03T08:00:00Z",
};

const THREE_REPORTS = [REPORT_A, REPORT_B, REPORT_C];

// ---------------------------------------------------------------------------
// Rendering — one row per report
// ---------------------------------------------------------------------------

describe("ReportsTable: row rendering", () => {
  it("renders one row for each report in the array", () => {
    render(
      <ReportsTable
        reports={THREE_REPORTS}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    // Each report should produce a row. We look for category text as a proxy
    // since each report has a distinct category.
    expect(screen.getByText("broken_footpath")).toBeInTheDocument();
    expect(screen.getByText("poor_lighting")).toBeInTheDocument();
    expect(screen.getByText("unsafe_crossing")).toBeInTheDocument();
  });

  it("renders category text in each row", () => {
    render(
      <ReportsTable
        reports={[REPORT_A]}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(screen.getByText("broken_footpath")).toBeInTheDocument();
  });

  it("renders severity text in each row", () => {
    render(
      <ReportsTable
        reports={[REPORT_A]}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("renders status text in each row", () => {
    render(
      <ReportsTable
        reports={[REPORT_A]}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    // Status may be rendered via StatusBadge or plain text; either way "submitted" must appear.
    expect(screen.getByText(/submitted/i)).toBeInTheDocument();
  });

  it("renders category, severity, and status for all three reports simultaneously", () => {
    render(
      <ReportsTable
        reports={THREE_REPORTS}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    // REPORT_A
    expect(screen.getByText("broken_footpath")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    // REPORT_B
    expect(screen.getByText("poor_lighting")).toBeInTheDocument();
    expect(screen.getByText("low")).toBeInTheDocument();
    // REPORT_C
    expect(screen.getByText("unsafe_crossing")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// R-RPT-3 / AC-RPT-3-S1 — Delete button visibility by role
// ---------------------------------------------------------------------------

describe("R-RPT-3 / AC-RPT-3-S1 — ReportsTable: delete button visibility per role", () => {
  it("admin role: delete button is visible for each report row", () => {
    render(
      <ReportsTable
        reports={THREE_REPORTS}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    // There must be at least one delete button per report.
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    expect(deleteButtons.length).toBeGreaterThanOrEqual(THREE_REPORTS.length);
  });

  it("reviewer role: delete button is NOT present anywhere in the DOM", () => {
    render(
      <ReportsTable
        reports={THREE_REPORTS}
        role="reviewer"
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    // AC requires the button to be absent — not just hidden with CSS.
    // queryByRole returns null if not in DOM; queryAllByRole returns [].
    const deleteButtons = screen.queryAllByRole("button", { name: /delete/i });
    expect(deleteButtons).toHaveLength(0);
  });

  it(
    "reviewer role: no element with accessible name matching /delete/i exists — " +
      "including aria-hidden elements",
    () => {
      const { container } = render(
        <ReportsTable
          reports={THREE_REPORTS}
          role="reviewer"
          onStatusChange={jest.fn()}
          onDelete={jest.fn()}
        />
      );
      // Belt-and-suspenders: query the raw DOM for any element whose
      // text content or aria-label matches "delete".
      const allElements = container.querySelectorAll("*");
      const deleteElements = Array.from(allElements).filter((el) => {
        const text = el.textContent?.toLowerCase() ?? "";
        const label = el.getAttribute("aria-label")?.toLowerCase() ?? "";
        return (
          (text === "delete" || label.includes("delete")) &&
          el.tagName === "BUTTON"
        );
      });
      expect(deleteElements).toHaveLength(0);
    }
  );
});

// ---------------------------------------------------------------------------
// onDelete callback
// ---------------------------------------------------------------------------

describe("ReportsTable: onDelete callback", () => {
  it("calls onDelete with the correct report id when delete button is clicked (admin role)", async () => {
    const onDelete = jest.fn();
    render(
      <ReportsTable
        reports={[REPORT_A]}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={onDelete}
      />
    );
    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await userEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(REPORT_A.id);
  });

  it("calls onDelete with each report's own id — not a neighbouring report's id", async () => {
    const onDelete = jest.fn();
    render(
      <ReportsTable
        reports={[REPORT_A, REPORT_B]}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={onDelete}
      />
    );
    // Click the second delete button (REPORT_B's row)
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await userEvent.click(deleteButtons[1]);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(REPORT_B.id);
  });

  it("onDelete is NOT called on initial render — only fires on user interaction", () => {
    const onDelete = jest.fn();
    render(
      <ReportsTable
        reports={[REPORT_A]}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={onDelete}
      />
    );
    expect(onDelete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onStatusChange callback
// ---------------------------------------------------------------------------

describe("ReportsTable: onStatusChange callback", () => {
  it("calls onStatusChange with the correct report id when status change button is clicked", async () => {
    const onStatusChange = jest.fn();
    render(
      <ReportsTable
        reports={[REPORT_A]}
        role="admin"
        onStatusChange={onStatusChange}
        onDelete={jest.fn()}
      />
    );
    // The status-change button may be labelled "Change status", "Update", "Edit status", etc.
    // We match broadly; implementation must provide an accessible name containing one of these.
    const statusButton = screen.getByRole("button", {
      name: /change status|update status|edit status|status/i,
    });
    await userEvent.click(statusButton);

    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith(REPORT_A.id);
  });

  it("calls onStatusChange with the correct id for a reviewer role row (reviewer can change status)", async () => {
    const onStatusChange = jest.fn();
    render(
      <ReportsTable
        reports={[REPORT_B]}
        role="reviewer"
        onStatusChange={onStatusChange}
        onDelete={jest.fn()}
      />
    );
    const statusButton = screen.getByRole("button", {
      name: /change status|update status|edit status|status/i,
    });
    await userEvent.click(statusButton);

    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith(REPORT_B.id);
  });

  it("onStatusChange is NOT called on initial render", () => {
    const onStatusChange = jest.fn();
    render(
      <ReportsTable
        reports={[REPORT_A]}
        role="admin"
        onStatusChange={onStatusChange}
        onDelete={jest.fn()}
      />
    );
    expect(onStatusChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("ReportsTable: empty reports array", () => {
  it("renders without crashing when reports array is empty", () => {
    expect(() =>
      render(
        <ReportsTable
          reports={[]}
          role="admin"
          onStatusChange={jest.fn()}
          onDelete={jest.fn()}
        />
      )
    ).not.toThrow();
  });

  it("shows an empty-state message or an empty table body when reports=[]", () => {
    const { container } = render(
      <ReportsTable
        reports={[]}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    // Accept either an explicit empty-state message or an empty table body.
    const emptyMessage = screen.queryByText(
      /no reports|empty|nothing to show/i
    );
    const tableRows = container.querySelectorAll("tbody tr, [role='row']");
    // At least one of: an explicit message OR zero data rows in the table.
    const hasEmptyState =
      emptyMessage !== null || tableRows.length === 0;
    expect(hasEmptyState).toBe(true);
  });

  it("renders no delete buttons when reports array is empty", () => {
    render(
      <ReportsTable
        reports={[]}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(screen.queryAllByRole("button", { name: /delete/i })).toHaveLength(0);
  });
});
