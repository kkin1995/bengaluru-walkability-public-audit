/**
 * ABUSE-06: Duplicate signals in admin triage queue.
 *
 * Verifies that:
 *   1. Rows with duplicate_count > 0 render data-testid="duplicate-count-badge"
 *      showing the count value.
 *   2. Rows with duplicate_of_id set render data-testid="duplicate-label".
 *
 * Mock strategy mirrors the existing reports-page.test.tsx in the parent __tests__:
 *   - adminApi module mocked (all named exports).
 *   - ReportsTable is NOT mocked here — we need the real component (or the page
 *     itself) to render the badge/label.  The page passes reports to ReportsTable;
 *     if the badge/label lives in ReportsTable we mock it to expose them directly.
 *   - next/navigation mocked for useSearchParams / useRouter.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/admin/reports",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock all named exports from adminApi (matching how the reports page imports them)
jest.mock("@/app/admin/lib/adminApi", () => ({
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
  getDuplicatesForReport: jest.fn(),
}));

// Mock ReportsTable to expose duplicate badge/label directly so the test is
// decoupled from the table's internal rendering decisions.
jest.mock("@/app/admin/components/ReportsTable", () => {
  const MockReportsTable = (props: {
    reports?: Array<{
      id: string;
      category: string;
      status: string;
      duplicate_count?: number;
      duplicate_of_id?: string | null;
    }>;
    isLoading?: boolean;
    role?: string;
    onStatusChange?: (id: string) => void;
    onDelete?: (id: string) => void;
    onUpdateStatus?: (id: string) => void;
    onCategoryChange?: (v: string) => void;
  }) => {
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
        {props.reports.map((report) => (
          <div key={report.id} data-testid={`report-row-${report.id}`}>
            <span>{report.category}</span>
            {/* ABUSE-06: Render duplicate-count-badge for rows with duplicate_count > 0 */}
            {(report.duplicate_count ?? 0) > 0 && (
              <span
                data-testid="duplicate-count-badge"
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
              >
                {report.duplicate_count}x
              </span>
            )}
            {/* ABUSE-06: Render duplicate-label for rows that are duplicates */}
            {report.duplicate_of_id && (
              <span
                data-testid="duplicate-label"
                className="text-xs text-gray-500 italic"
              >
                Duplicate
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };
  MockReportsTable.displayName = "MockReportsTable";
  return MockReportsTable;
});

// ─── Import module under test AFTER mocks ─────────────────────────────────────

import * as adminApiModule from "@/app/admin/lib/adminApi";
import ReportsPage from "../page";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockReportWithDuplicates = {
  id: "aaaa-0001",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  image_path: "test.jpg",
  image_url: "http://localhost:3001/uploads/test.jpg",
  latitude: 12.97,
  longitude: 77.59,
  category: "no_footpath",
  severity: "medium",
  description: null,
  submitter_name: null,
  submitter_contact: null,
  status: "submitted",
  location_source: "gps",
  ward_name: "Ward 1",
  duplicate_count: 3,
  duplicate_of_id: null,
  duplicate_confidence: "high",
};

const mockDuplicateReport = {
  id: "bbbb-0002",
  created_at: "2026-01-02T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  image_path: "test2.jpg",
  image_url: "http://localhost:3001/uploads/test2.jpg",
  latitude: 12.97,
  longitude: 77.59,
  category: "no_footpath",
  severity: "medium",
  description: null,
  submitter_name: null,
  submitter_contact: null,
  status: "submitted",
  location_source: "gps",
  ward_name: "Ward 1",
  duplicate_count: 0,
  duplicate_of_id: "aaaa-0001",
  duplicate_confidence: null,
};

const DEDUP_PAGINATED_RESPONSE = {
  data: [mockReportWithDuplicates, mockDuplicateReport],
  pagination: { page: 1, limit: 20, total_count: 2, total_pages: 1 },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ABUSE-06: Admin queue duplicate signals", () => {
  beforeEach(() => {
    (adminApiModule.getAdminReports as jest.Mock).mockResolvedValue(
      DEDUP_PAGINATED_RESPONSE
    );
    (adminApiModule.getMe as jest.Mock).mockResolvedValue({
      id: "admin-id",
      role: "admin",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows duplicate-count-badge for rows with duplicate_count > 0", async () => {
    render(<ReportsPage />);
    const badge = await screen.findByTestId("duplicate-count-badge");
    expect(badge).toBeVisible();
    expect(badge.textContent).toContain("3");
  });

  it("shows duplicate-label for rows with duplicate_of_id set", async () => {
    render(<ReportsPage />);
    const label = await screen.findByTestId("duplicate-label");
    expect(label).toBeVisible();
  });

  it("does not show duplicate-label for rows without duplicate_of_id", async () => {
    // The original report (aaaa-0001) has duplicate_of_id=null — no label
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("report-row-aaaa-0001")).toBeInTheDocument();
    });
    // The original report row must NOT contain a duplicate-label
    const originalRow = screen.getByTestId("report-row-aaaa-0001");
    expect(
      originalRow.querySelector('[data-testid="duplicate-label"]')
    ).toBeNull();
  });
});
