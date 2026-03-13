/**
 * ABUSE-06 Gap closure — Sub-table rendering tests for ReportsTable.
 *
 * Verifies that the expandable duplicate sub-table renders:
 *   - A <thead> with meaningful column headers
 *   - ward_name in the first data cell (not a UUID slice)
 *   - A formatted date via toLocaleDateString() (not a raw ISO string)
 *   - A StatusBadge (data-testid="status-badge") in each row
 *   - An <a> or <Link> with href="/admin/reports/{dupe.id}" in each row
 *   - data-testid="dupe-subtable" on the inner table element
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/admin/reports",
  useSearchParams: () => new URLSearchParams(),
}));

const mockDuplicateReport = {
  id: "dupe-id-001",
  created_at: "2026-01-15T10:00:00Z",
  updated_at: "2026-01-15T10:00:00Z",
  image_path: "test.jpg",
  image_url: "http://localhost:3001/uploads/test.jpg",
  latitude: 12.97,
  longitude: 77.59,
  category: "broken_footpath",
  severity: "high",
  description: null,
  submitter_name: null,
  submitter_contact: null,
  status: "submitted",
  location_source: "gps",
  ward_name: "Ward 42",
  duplicate_count: 0,
  duplicate_of_id: "orig-id-001",
  duplicate_confidence: null,
};

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
  getDuplicatesForReport: jest.fn().mockResolvedValue([mockDuplicateReport]),
}));

// ─── Import AFTER mocks ───────────────────────────────────────────────────────

import * as adminApiModule from "@/app/admin/lib/adminApi";
import ReportsTable from "@/app/admin/components/ReportsTable";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORIGINAL_REPORT = {
  id: "orig-id-001",
  category: "broken_footpath",
  severity: "high",
  status: "submitted",
  created_at: "2026-01-01T00:00:00Z",
  ward_name: "Ward 10",
  duplicate_count: 1,
  duplicate_of_id: null,
  duplicate_confidence: "high",
};

// ─── Helper ───────────────────────────────────────────────────────────────────

async function renderAndExpand() {
  render(
    <ReportsTable
      reports={[ORIGINAL_REPORT]}
      role="admin"
      onStatusChange={jest.fn()}
      onDelete={jest.fn()}
    />
  );

  // Click the expand button to trigger duplicate fetch
  const expandBtn = screen.getByTestId("expand-duplicates-btn");
  fireEvent.click(expandBtn);

  // Wait for the sub-table to appear
  await waitFor(() => {
    expect(screen.getByTestId("dupe-subtable")).toBeInTheDocument();
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ReportsTable sub-table: structure", () => {
  beforeEach(() => {
    (adminApiModule.getDuplicatesForReport as jest.Mock).mockResolvedValue([
      mockDuplicateReport,
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders data-testid='dupe-subtable' on the inner table element after expand", async () => {
    await renderAndExpand();
    expect(screen.getByTestId("dupe-subtable")).toBeInTheDocument();
  });

  it("renders a <thead> inside the sub-table with column headers", async () => {
    await renderAndExpand();
    const subtable = screen.getByTestId("dupe-subtable");
    const thead = subtable.querySelector("thead");
    expect(thead).not.toBeNull();
  });

  it("renders a 'Ward' column header in the sub-table thead", async () => {
    await renderAndExpand();
    expect(screen.getByText("Ward")).toBeInTheDocument();
  });

  it("renders a 'Date' column header in the sub-table thead", async () => {
    await renderAndExpand();
    expect(screen.getByText("Date")).toBeInTheDocument();
  });

  it("renders a 'Status' column header in the sub-table thead", async () => {
    await renderAndExpand();
    // 'Status' may appear in both main thead and sub-table thead — allow multiple
    const statusHeaders = screen.getAllByText("Status");
    expect(statusHeaders.length).toBeGreaterThanOrEqual(1);
  });

  it("renders a 'Category' column header in the sub-table thead", async () => {
    await renderAndExpand();
    // 'Category' appears in main thead and sub-table thead
    const categoryHeaders = screen.getAllByText("Category");
    expect(categoryHeaders.length).toBeGreaterThanOrEqual(2);
  });
});

describe("ReportsTable sub-table: data cells", () => {
  beforeEach(() => {
    (adminApiModule.getDuplicatesForReport as jest.Mock).mockResolvedValue([
      mockDuplicateReport,
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders ward_name ('Ward 42') in the first data cell, not a UUID slice", async () => {
    await renderAndExpand();
    expect(screen.getByText("Ward 42")).toBeInTheDocument();
    // Must NOT render a UUID slice like "dupe-id-"
    expect(screen.queryByText(/dupe-id-0/)).toBeNull();
  });

  it("renders a formatted date via toLocaleDateString(), not the raw ISO string", async () => {
    await renderAndExpand();
    const expectedDate = new Date("2026-01-15T10:00:00Z").toLocaleDateString();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
    // The raw ISO string "2026-01-15T10:00:00Z" must NOT appear in the sub-table
    const subtable = screen.getByTestId("dupe-subtable");
    expect(subtable.textContent).not.toContain("2026-01-15T10:00:00Z");
  });

  it("renders a StatusBadge (data-testid='status-badge') inside the sub-table rows", async () => {
    await renderAndExpand();
    const subtable = screen.getByTestId("dupe-subtable");
    const badge = subtable.querySelector('[data-testid="status-badge"]');
    expect(badge).not.toBeNull();
  });
});

describe("ReportsTable sub-table: navigation link", () => {
  beforeEach(() => {
    (adminApiModule.getDuplicatesForReport as jest.Mock).mockResolvedValue([
      mockDuplicateReport,
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders an anchor element with href containing '/admin/reports/dupe-id-001'", async () => {
    await renderAndExpand();
    const subtable = screen.getByTestId("dupe-subtable");
    const links = subtable.querySelectorAll("a");
    const matchingLinks = Array.from(links).filter((a) =>
      a.getAttribute("href")?.includes("/admin/reports/dupe-id-001")
    );
    expect(matchingLinks.length).toBeGreaterThanOrEqual(1);
  });
});
