/**
 * Tests for ward name column in the admin reports triage queue.
 *
 * Requirements covered:
 *   WARD-01 — Admin reports triage queue shows a ward name column per report
 *
 * Mocking strategy:
 *   - adminApi module is fully mocked; getAdminReports() returns reports with
 *     and without ward_name to verify both display paths.
 *   - ReportsTable is rendered directly (not mocked) so we can assert on the
 *     actual DOM output including the Ward column.
 *   - No real network calls are made.
 *
 * Determinism:
 *   No wall-clock time or random seeds used.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
  listOrganizations: jest.fn(),
  assignUserOrg: jest.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Import under test AFTER mocks
// ─────────────────────────────────────────────────────────────────────────────

import ReportsTable from "../components/ReportsTable";
import * as adminApi from "../lib/adminApi";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const REPORT_WITH_WARD = {
  id: "report-uuid-001",
  created_at: "2026-03-10T10:00:00Z",
  updated_at: "2026-03-10T10:00:00Z",
  image_path: "photo1.jpg",
  image_url: "http://localhost:3001/uploads/photo1.jpg",
  latitude: 12.9716,
  longitude: 77.5946,
  category: "broken_footpath",
  severity: "high",
  description: "Cracked footpath",
  submitter_name: "Alice",
  submitter_contact: "alice@example.com",
  status: "submitted",
  location_source: "exif",
  ward_name: "Shivajinagar",
};

const REPORT_WITHOUT_WARD = {
  id: "report-uuid-002",
  created_at: "2026-03-09T09:00:00Z",
  updated_at: "2026-03-09T09:00:00Z",
  image_path: "photo2.jpg",
  image_url: "http://localhost:3001/uploads/photo2.jpg",
  latitude: 12.985,
  longitude: 77.6,
  category: "no_footpath",
  severity: "medium",
  description: null,
  submitter_name: null,
  submitter_contact: null,
  status: "under_review",
  location_source: "manual_pin",
  ward_name: null,
};

const PAGINATED_RESPONSE = (reports: typeof REPORT_WITH_WARD[]) => ({
  data: reports,
  pagination: { page: 1, limit: 20, total_count: reports.length, total_pages: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// WARD-01 — Ward column header
// ─────────────────────────────────────────────────────────────────────────────

describe("WARD-01 — Ward column header is present in reports table", () => {
  it("renders a 'Ward' column header in the reports table", () => {
    render(
      <ReportsTable
        reports={[REPORT_WITH_WARD]}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
        isLoading={false}
      />
    );

    // Reports table must include a "Ward" column header
    expect(screen.getByText("Ward")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WARD-01 — Ward name display when present
// ─────────────────────────────────────────────────────────────────────────────

describe("WARD-01 — Ward name displays correctly when present", () => {
  it("displays the ward_name value when the report has a ward assignment", () => {
    render(
      <ReportsTable
        reports={[REPORT_WITH_WARD]}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
        isLoading={false}
      />
    );

    // The ward name "Shivajinagar" must be visible in the report row
    expect(screen.getByText("Shivajinagar")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WARD-01 — Null ward_name renders "—" placeholder
// ─────────────────────────────────────────────────────────────────────────────

describe("WARD-01 — Null ward_name renders em-dash placeholder without crashing", () => {
  it("displays an em-dash when ward_name is null", () => {
    render(
      <ReportsTable
        reports={[REPORT_WITHOUT_WARD]}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
        isLoading={false}
      />
    );

    // Null ward_name must render as "—" (em dash U+2014), not crash or show blank
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("does not crash when ward_name is null", () => {
    expect(() => {
      render(
        <ReportsTable
          reports={[REPORT_WITHOUT_WARD]}
          role="admin"
          onStatusChange={jest.fn()}
          onDelete={jest.fn()}
          isLoading={false}
        />
      );
    }).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WARD-01 — Both present and null ward in same table
// ─────────────────────────────────────────────────────────────────────────────

describe("WARD-01 — Mixed ward assignment in same table", () => {
  it("shows ward name for assigned report and em-dash for null report in the same table", () => {
    render(
      <ReportsTable
        reports={[REPORT_WITH_WARD, REPORT_WITHOUT_WARD]}
        role="admin"
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
        isLoading={false}
      />
    );

    // Named ward must appear
    expect(screen.getByText("Shivajinagar")).toBeInTheDocument();
    // Null ward must show em-dash placeholder
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

// Suppress unused import warning — adminApi is imported for completeness
void adminApi;
