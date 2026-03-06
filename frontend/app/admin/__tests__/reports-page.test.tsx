/**
 * Tests for frontend/app/admin/reports/page.tsx — Admin Reports Page
 *
 * Requirements covered:
 *   R-RPT-1 / AC-RPT-1-S1  — filter controls call getAdminReports() with updated params
 *   R-RPT-1 / AC-RPT-1-S2  — URL params restore filter state on page load
 *   R-RPT-3 / AC-RPT-3-S1  — admin role: delete button visible; reviewer: absent
 *   EC-FE-5                 — empty result set renders empty-state message
 *
 * Mocking strategy:
 *   - adminApi module is fully mocked; getAdminReports() and deleteReport()
 *     are controlled per-test.
 *   - ReportsTable is mocked to expose props received and simulate user actions.
 *   - useSearchParams / useRouter from next/navigation are mocked so URL
 *     manipulation can be observed without a real browser history.
 *   - No real network calls are made.
 *
 * Determinism:
 *   No wall-clock time or random seeds used.
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────────

// Capture mock router so tests can assert on router.push calls
const mockRouterPush = jest.fn();
let mockSearchParamsString = "";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsString),
  usePathname: () => "/admin/reports",
}));

jest.mock("../lib/adminApi", () => ({
  getAdminReports: jest.fn(),
  deleteReport: jest.fn(),
  getStats: jest.fn(),
  getUsers: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  getMe: jest.fn(),
  getAdminReport: jest.fn(),
  updateReportStatus: jest.fn(),
  createUser: jest.fn(),
  deactivateUser: jest.fn(),
}));

// ReportsTable mock — renders the reports and exposes controls
// Captures: reports data, role, filter-change callbacks, delete callback
let capturedReportsTableProps: Record<string, unknown> = {};

jest.mock("../components/ReportsTable", () => {
  const MockReportsTable = (props: {
    reports: Array<{ id: string; category: string; status: string }>;
    role: string;
    onCategoryChange?: (v: string) => void;
    onStatusChange?: (v: string) => void;
    onDelete?: (id: string) => void;
    isLoading?: boolean;
  }) => {
    // Capture props for assertions
    capturedReportsTableProps = props as unknown as Record<string, unknown>;

    if (props.isLoading) {
      return <div data-testid="reports-table-loading" />;
    }

    if (!props.reports || props.reports.length === 0) {
      return (
        <div data-testid="reports-table-empty">
          <p>No reports found</p>
        </div>
      );
    }

    return (
      <div data-testid="reports-table">
        {/* Filter controls */}
        <select
          data-testid="category-filter"
          onChange={(e) => props.onCategoryChange?.(e.target.value)}
          defaultValue=""
        >
          <option value="">All categories</option>
          <option value="broken_footpath">Broken Footpath</option>
          <option value="no_footpath">No Footpath</option>
        </select>

        <select
          data-testid="status-filter"
          onChange={(e) => props.onStatusChange?.(e.target.value)}
          defaultValue=""
        >
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="resolved">Resolved</option>
        </select>

        {/* Report rows */}
        {props.reports.map((report) => (
          <div key={report.id} data-testid={`report-row-${report.id}`}>
            <span data-testid={`report-category-${report.id}`}>{report.category}</span>
            <span data-testid={`report-status-${report.id}`}>{report.status}</span>
            {/* Delete button — only rendered for admin role */}
            {props.role === "admin" && (
              <button
                data-testid={`delete-button-${report.id}`}
                onClick={() => props.onDelete?.(report.id)}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };
  MockReportsTable.displayName = "MockReportsTable";
  return MockReportsTable;
});

// ─────────────────────────────────────────────────────────────────────────────
// Import module under test AFTER mocks are declared
// ─────────────────────────────────────────────────────────────────────────────

import ReportsPage from "../reports/page";
import * as adminApi from "../lib/adminApi";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const REPORT_FIXTURE_1 = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  created_at: "2026-03-05T10:00:00Z",
  updated_at: "2026-03-05T10:00:00Z",
  image_path: "photo1.jpg",
  image_url: "http://localhost:3001/uploads/photo1.jpg",
  latitude: 12.9716,
  longitude: 77.5946,
  category: "broken_footpath",
  severity: "high",
  description: "Large pothole",
  submitter_name: "Alice",
  submitter_contact: "alice@example.com",
  status: "submitted",
  location_source: "exif",
};

const REPORT_FIXTURE_2 = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  created_at: "2026-03-04T09:00:00Z",
  updated_at: "2026-03-04T09:00:00Z",
  image_path: "photo2.jpg",
  image_url: "http://localhost:3001/uploads/photo2.jpg",
  latitude: 12.985,
  longitude: 77.6,
  category: "poor_lighting",
  severity: "medium",
  description: "No streetlights",
  submitter_name: null,
  submitter_contact: null,
  status: "under_review",
  location_source: "manual_pin",
};

const PAGINATED_RESPONSE = (
  reports: typeof REPORT_FIXTURE_1[] = [REPORT_FIXTURE_1, REPORT_FIXTURE_2]
) => ({
  data: reports,
  pagination: { page: 1, limit: 20, total_count: reports.length, total_pages: 1 },
});

// Helper: build a page with a given role prop
// The implementation may receive role from context/layout.
// We pass it as a prop here because the page stub is a simple component.
function renderPage(role: "admin" | "reviewer" = "admin") {
  // The page component may accept `role` as a prop or read it from context.
  // We attempt to render with the prop; if the impl uses context, this test
  // will still verify the behavior via mock assertions.
  return render(<ReportsPage {...({ role } as Record<string, unknown>)} />);
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup / teardown
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSearchParamsString = "";
  mockRouterPush.mockClear();
  capturedReportsTableProps = {};
});

// ─────────────────────────────────────────────────────────────────────────────
// R-RPT-1 — Reports table renders with data from getAdminReports()
// ─────────────────────────────────────────────────────────────────────────────

describe("R-RPT-1 — ReportsTable renders with data fetched from getAdminReports()", () => {
  it("calls getAdminReports() on mount", async () => {
    (adminApi.getAdminReports as jest.Mock).mockResolvedValueOnce(
      PAGINATED_RESPONSE()
    );
    renderPage();
    await waitFor(() => {
      // Reports page must call getAdminReports() on mount
      expect(adminApi.getAdminReports).toHaveBeenCalledTimes(1);
    });
  });

  it("renders a reports table with the fetched report data", async () => {
    (adminApi.getAdminReports as jest.Mock).mockResolvedValueOnce(
      PAGINATED_RESPONSE()
    );
    renderPage();
    await waitFor(() => {
      // ReportsTable must render after getAdminReports() resolves
      expect(screen.getByTestId("reports-table")).toBeInTheDocument();
    });
  });

  it("renders a row for each report returned by the API", async () => {
    (adminApi.getAdminReports as jest.Mock).mockResolvedValueOnce(
      PAGINATED_RESPONSE()
    );
    renderPage();
    await waitFor(() => {
      // Each report from the API must appear as a row in ReportsTable
      expect(
        screen.getByTestId(`report-row-${REPORT_FIXTURE_1.id}`)
      ).toBeInTheDocument();
      // All reports must be rendered — second report missing from the table
      expect(
        screen.getByTestId(`report-row-${REPORT_FIXTURE_2.id}`)
      ).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R-RPT-1 — Category and status filter controls
// ─────────────────────────────────────────────────────────────────────────────

describe("R-RPT-1 — Filter controls call getAdminReports() with updated parameters", () => {
  it("renders a category filter control", async () => {
    (adminApi.getAdminReports as jest.Mock).mockResolvedValueOnce(
      PAGINATED_RESPONSE()
    );
    renderPage();
    await waitFor(() => {
      // Reports page must render a category filter select element
      expect(screen.getByTestId("category-filter")).toBeInTheDocument();
    });
  });

  it("renders a status filter control", async () => {
    (adminApi.getAdminReports as jest.Mock).mockResolvedValueOnce(
      PAGINATED_RESPONSE()
    );
    renderPage();
    await waitFor(() => {
      // Reports page must render a status filter select element
      expect(screen.getByTestId("status-filter")).toBeInTheDocument();
    });
  });

  it("changing the category filter calls getAdminReports() with the new category param", async () => {
    (adminApi.getAdminReports as jest.Mock)
      .mockResolvedValueOnce(PAGINATED_RESPONSE())          // initial load
      .mockResolvedValueOnce(PAGINATED_RESPONSE([REPORT_FIXTURE_1])); // after filter

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("category-filter")).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.selectOptions(
        screen.getByTestId("category-filter"),
        "broken_footpath"
      );
    });

    await waitFor(() => {
      // Changing the category filter must trigger a new getAdminReports() call
      expect(adminApi.getAdminReports).toHaveBeenCalledTimes(2);
      // The second call must include category in its argument
      const secondCallArg = (adminApi.getAdminReports as jest.Mock).mock.calls[1][0];
      // Second getAdminReports() call must pass { category: 'broken_footpath' }
      expect(secondCallArg).toMatchObject({ category: "broken_footpath" });
    });
  });

  it("changing the status filter calls getAdminReports() with the new status param", async () => {
    (adminApi.getAdminReports as jest.Mock)
      .mockResolvedValueOnce(PAGINATED_RESPONSE())
      .mockResolvedValueOnce(PAGINATED_RESPONSE([REPORT_FIXTURE_1]));

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("status-filter")).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.selectOptions(
        screen.getByTestId("status-filter"),
        "under_review"
      );
    });

    await waitFor(() => {
      expect(adminApi.getAdminReports).toHaveBeenCalledTimes(2);
      const secondCallArg = (adminApi.getAdminReports as jest.Mock).mock.calls[1][0];
      // Second getAdminReports() call must pass { status: 'under_review' }
      expect(secondCallArg).toMatchObject({ status: "under_review" });
    });
  });

  it("URL params are restored into filter state on page load", async () => {
    // Pre-set URL search params so they are visible at mount time
    mockSearchParamsString = "category=broken_footpath&status=submitted";
    (adminApi.getAdminReports as jest.Mock).mockResolvedValueOnce(
      PAGINATED_RESPONSE([REPORT_FIXTURE_1])
    );

    renderPage();

    await waitFor(() => {
      // getAdminReports() must be called with filters restored from URL params on initial render
      expect(adminApi.getAdminReports).toHaveBeenCalledWith(
        expect.objectContaining({ category: "broken_footpath", status: "submitted" })
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R-RPT-3 / AC-RPT-3-S1 — Admin sees delete button; reviewer does not
// ─────────────────────────────────────────────────────────────────────────────

describe("R-RPT-3 / AC-RPT-3-S1 — Delete button visibility is role-dependent", () => {
  it("delete button IS present for admin role", async () => {
    (adminApi.getAdminReports as jest.Mock).mockResolvedValueOnce(
      PAGINATED_RESPONSE()
    );
    renderPage("admin");

    await waitFor(() => {
      // Admin role must see a delete button for each report row
      expect(
        screen.getByTestId(`delete-button-${REPORT_FIXTURE_1.id}`)
      ).toBeInTheDocument();
    });
  });

  it("delete button is NOT present for reviewer role", async () => {
    (adminApi.getAdminReports as jest.Mock).mockResolvedValueOnce(
      PAGINATED_RESPONSE()
    );
    renderPage("reviewer");

    await waitFor(() => {
      // Reviewer role must NOT see a delete button — no mechanism for report deletion
      expect(
        screen.queryByTestId(`delete-button-${REPORT_FIXTURE_1.id}`)
      ).not.toBeInTheDocument();
    });
  });

  it("delete button is NOT present for any row when role is reviewer", async () => {
    (adminApi.getAdminReports as jest.Mock).mockResolvedValueOnce(
      PAGINATED_RESPONSE()
    );
    renderPage("reviewer");

    await waitFor(() => {
      // Both reports must lack delete buttons
      // No delete button must appear for reviewer — checked second report row
      expect(
        screen.queryByTestId(`delete-button-${REPORT_FIXTURE_2.id}`)
      ).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R-RPT-3 — Clicking delete (admin) calls deleteReport() and refreshes
// ─────────────────────────────────────────────────────────────────────────────

describe("R-RPT-3 — Admin clicking delete calls deleteReport() and refreshes the table", () => {
  it("clicking delete for a report calls deleteReport() with that report's ID", async () => {
    (adminApi.getAdminReports as jest.Mock)
      .mockResolvedValueOnce(PAGINATED_RESPONSE())
      .mockResolvedValueOnce(PAGINATED_RESPONSE([REPORT_FIXTURE_2])); // after deletion

    (adminApi.deleteReport as jest.Mock).mockResolvedValueOnce(undefined);

    renderPage("admin");

    await waitFor(() => {
      expect(
        screen.getByTestId(`delete-button-${REPORT_FIXTURE_1.id}`)
      ).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(
        screen.getByTestId(`delete-button-${REPORT_FIXTURE_1.id}`)
      );
    });

    await waitFor(() => {
      // deleteReport() must be called with the ID of the deleted report
      expect(adminApi.deleteReport).toHaveBeenCalledWith(REPORT_FIXTURE_1.id);
    });
  });

  it("after deleteReport() resolves, getAdminReports() is called again to refresh the list", async () => {
    (adminApi.getAdminReports as jest.Mock)
      .mockResolvedValueOnce(PAGINATED_RESPONSE())
      .mockResolvedValueOnce(PAGINATED_RESPONSE([REPORT_FIXTURE_2]));

    (adminApi.deleteReport as jest.Mock).mockResolvedValueOnce(undefined);

    renderPage("admin");

    await waitFor(() => {
      expect(
        screen.getByTestId(`delete-button-${REPORT_FIXTURE_1.id}`)
      ).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(
        screen.getByTestId(`delete-button-${REPORT_FIXTURE_1.id}`)
      );
    });

    await waitFor(() => {
      // After deletion, the page must re-fetch the report list via getAdminReports()
      expect(adminApi.getAdminReports).toHaveBeenCalledTimes(2);
    });
  });

  it("the deleted report's row is no longer visible after refresh", async () => {
    (adminApi.getAdminReports as jest.Mock)
      .mockResolvedValueOnce(PAGINATED_RESPONSE())
      .mockResolvedValueOnce(PAGINATED_RESPONSE([REPORT_FIXTURE_2])); // list without report 1

    (adminApi.deleteReport as jest.Mock).mockResolvedValueOnce(undefined);

    renderPage("admin");

    await waitFor(() => {
      expect(
        screen.getByTestId(`delete-button-${REPORT_FIXTURE_1.id}`)
      ).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(
        screen.getByTestId(`delete-button-${REPORT_FIXTURE_1.id}`)
      );
    });

    await waitFor(() => {
      // After deletion, the deleted report must no longer appear in the table
      expect(
        screen.queryByTestId(`report-row-${REPORT_FIXTURE_1.id}`)
      ).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EC-FE-5 — Empty result set shows empty state message
// ─────────────────────────────────────────────────────────────────────────────

describe("EC-FE-5 — Empty result set renders an empty-state message", () => {
  it("shows 'No reports found' when getAdminReports() returns an empty data array", async () => {
    (adminApi.getAdminReports as jest.Mock).mockResolvedValueOnce(
      PAGINATED_RESPONSE([])
    );
    renderPage();

    await waitFor(() => {
      // When the API returns an empty list, a 'No reports found' message must appear — not a blank table
      expect(
        screen.getByText(/no reports found/i)
      ).toBeInTheDocument();
    });
  });

  it("the empty state renders inside the table area (not a blank page)", async () => {
    (adminApi.getAdminReports as jest.Mock).mockResolvedValueOnce(
      PAGINATED_RESPONSE([])
    );
    renderPage();

    await waitFor(() => {
      // Empty state must render within the table container, not replace the whole page
      expect(screen.getByTestId("reports-table-empty")).toBeInTheDocument();
    });
  });
});
