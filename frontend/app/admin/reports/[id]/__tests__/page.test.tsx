/**
 * Tests for frontend/app/admin/reports/[id]/page.tsx
 *
 * Verifies:
 *   - Calls getAdminReport("test-report-id") on mount with the route param id
 *   - Renders the report photo (<img>) with src matching report.image_url
 *   - Renders report.category text
 *   - Renders report.description text (or "No description" when null)
 *   - Renders report.ward_name (or "—" when null)
 *   - Renders report.status wrapped in StatusBadge (data-testid="status-badge")
 *   - Renders formatted created_at date via toLocaleDateString()
 *   - Shows a loading state before data resolves
 *   - Shows an error state when getAdminReport rejects
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/admin/reports/test-report-id",
  useSearchParams: () => new URLSearchParams(),
}));

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

// ─── Import AFTER mocks ───────────────────────────────────────────────────────

import * as adminApiModule from "@/app/admin/lib/adminApi";
import ReportDetailPage from "@/app/admin/reports/[id]/page";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL_REPORT = {
  id: "test-report-id",
  created_at: "2026-02-10T08:30:00Z",
  updated_at: "2026-02-11T09:00:00Z",
  image_path: "uploads/test-photo.jpg",
  image_url: "http://localhost:3001/uploads/test-photo.jpg",
  latitude: 12.97,
  longitude: 77.59,
  category: "broken_footpath",
  severity: "high",
  description: "Large crack in the footpath near bus stop",
  submitter_name: "Ravi Kumar",
  submitter_contact: "ravi@example.com",
  status: "submitted",
  location_source: "gps",
  ward_name: "Ward 27",
  duplicate_count: 0,
  duplicate_of_id: null,
  duplicate_confidence: null,
  // Phase 03 required fields
  resolution_photo_url: null,
  resolution_notes: null,
  assigned_org_id: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ReportDetailPage: data fetching", () => {
  beforeEach(() => {
    (adminApiModule.getMe as jest.Mock).mockResolvedValue({ role: "admin" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls getAdminReport with the route param id on mount", async () => {
    (adminApiModule.getAdminReport as jest.Mock).mockResolvedValue(FULL_REPORT);

    render(<ReportDetailPage params={{ id: "test-report-id" }} />);

    await screen.findByTestId("report-detail");
    expect(adminApiModule.getAdminReport).toHaveBeenCalledWith("test-report-id");
  });

  it("shows a loading state before data resolves", async () => {
    let resolvePromise!: (value: typeof FULL_REPORT) => void;
    const pendingPromise = new Promise<typeof FULL_REPORT>((resolve) => {
      resolvePromise = resolve;
    });
    (adminApiModule.getAdminReport as jest.Mock).mockReturnValue(pendingPromise);

    render(<ReportDetailPage params={{ id: "test-report-id" }} />);

    expect(screen.getByTestId("report-detail-loading")).toBeInTheDocument();

    // Resolve to avoid act() warnings
    resolvePromise(FULL_REPORT);
    await screen.findByTestId("report-detail");
  });

  it("shows an error state when getAdminReport rejects", async () => {
    (adminApiModule.getAdminReport as jest.Mock).mockRejectedValue(
      new Error("HTTP 404")
    );

    render(<ReportDetailPage params={{ id: "test-report-id" }} />);

    await screen.findByTestId("report-detail-error");
    expect(screen.getByTestId("report-detail-error")).toBeInTheDocument();
  });
});

describe("ReportDetailPage: content rendering", () => {
  beforeEach(() => {
    (adminApiModule.getMe as jest.Mock).mockResolvedValue({ role: "admin" });
    (adminApiModule.getAdminReport as jest.Mock).mockResolvedValue(FULL_REPORT);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders data-testid='report-detail' on the root element", async () => {
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    expect(screen.getByTestId("report-detail")).toBeInTheDocument();
  });

  it("renders the report photo as an <img> with src matching image_url", async () => {
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", FULL_REPORT.image_url);
  });

  it("renders the category text", async () => {
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    expect(screen.getByText("broken_footpath")).toBeInTheDocument();
  });

  it("renders the description text when present", async () => {
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    expect(
      screen.getByText("Large crack in the footpath near bus stop")
    ).toBeInTheDocument();
  });

  it("renders 'No description' when description is null", async () => {
    const reportWithNoDesc = { ...FULL_REPORT, description: null };
    (adminApiModule.getAdminReport as jest.Mock).mockResolvedValue(
      reportWithNoDesc
    );

    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    expect(screen.getByText("No description")).toBeInTheDocument();
  });

  it("renders the ward_name when present", async () => {
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    expect(screen.getByText("Ward 27")).toBeInTheDocument();
  });

  it("renders '—' for ward when ward_name is null", async () => {
    const reportWithNoWard = { ...FULL_REPORT, ward_name: null };
    (adminApiModule.getAdminReport as jest.Mock).mockResolvedValue(
      reportWithNoWard
    );

    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    // "—" appears at least once (ward cell)
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders StatusBadge (data-testid='status-badge') with the report status", async () => {
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    expect(screen.getByTestId("status-badge")).toBeInTheDocument();
  });

  it("renders the created_at date formatted via toLocaleDateString()", async () => {
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    const expectedDate = new Date(FULL_REPORT.created_at).toLocaleDateString();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
    // The raw ISO string must NOT appear
    expect(screen.queryByText(FULL_REPORT.created_at)).toBeNull();
  });
});

// ─── Phase 3.1 Fixtures ───────────────────────────────────────────────────────

const PHASE3_REPORT = {
  ...FULL_REPORT,
  status: "open",
  ward_hierarchy: {
    ward_name: "Shivajinagar",
    ward_number: 117,
    corporation: "West",
    zone_name: "West Zone",
    ro_division: "West Division",
    aro_sub_division: "Shivajinagar Sub Division",
    assembly_constituency: "Shivajinagar",
    assembly_constituency_no: 155,
    parliamentary_constituency: "Bangalore Central",
    mla_name: "Rizwan Arshad",
    mp_name: "P.C. Mohan",
  },
};

// ─── Phase 3.1 / F-07 — Layout tests ─────────────────────────────────────────

describe("Phase 3.1 / F-07 — Layout: identity strip and action rail", () => {
  beforeEach(() => {
    (adminApiModule.getMe as jest.Mock).mockResolvedValue({ role: "admin" });
    (adminApiModule.getAdminReport as jest.Mock).mockResolvedValue(PHASE3_REPORT);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders StatusBadge (data-testid=status-badge) somewhere in the page", async () => {
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    expect(screen.getByTestId("status-badge")).toBeInTheDocument();
  });

  it("renders the ward_name telemetry text", async () => {
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    expect(screen.getByText("Ward 27")).toBeInTheDocument();
  });

  it("renders the CATEGORY telemetry value with raw category slug", async () => {
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    expect(screen.getByText("broken_footpath")).toBeInTheDocument();
  });
});

// ─── Phase 3.1 / ISSUE-06 — Status timeline dot color tests ──────────────────

describe("Phase 3.1 / ISSUE-06 — Status timeline dot uses Phase 3 enum tokens", () => {
  beforeEach(() => {
    (adminApiModule.getMe as jest.Mock).mockResolvedValue({ role: "admin" });
    (adminApiModule.getAdminReport as jest.Mock).mockResolvedValue(PHASE3_REPORT);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("status dot does NOT reference legacy --status-submitted or --status-review tokens", async () => {
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    // Find the timeline dot by its data-status-token attribute (JSDOM drops background: var() from style)
    const timelineDot = document.querySelector('[data-status-token]') as HTMLElement | null;
    const tokenValue = timelineDot?.getAttribute("data-status-token") ?? "";
    expect(tokenValue).not.toContain("status-submitted");
    expect(tokenValue).not.toContain("status-review");
  });

  it("status dot uses --status-open token when report.status is 'open'", async () => {
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    // Find the timeline dot by its data-status-token attribute (JSDOM drops background: var() from style)
    const timelineDot = document.querySelector('[data-status-token]') as HTMLElement | null;
    const tokenValue = timelineDot?.getAttribute("data-status-token") ?? "";
    expect(tokenValue).toContain("status-open");
  });
});

// ─── Phase 03.2 / BUG-03.1-C — Status history rendering tests ────────────────

const STATUS_HISTORY_REPORT = {
  ...PHASE3_REPORT,
  status: "acknowledged",
  updated_at: "2026-03-01T10:00:00Z",
  status_history: [
    {
      id: "sh-1",
      old_status: "open",
      new_status: "acknowledged",
      changed_at: "2026-03-01T10:00:00Z",
      note: null,
      changed_by: "admin-1",
      changed_by_name: "Priya Rao",
    },
    {
      id: "sh-2",
      old_status: null,
      new_status: "open",
      changed_at: "2026-02-10T08:30:00Z",
      note: null,
      changed_by: null,
      changed_by_name: null,
    },
  ],
};

describe("Phase 03.2 / BUG-03.1-C — Status history renders real audit entries", () => {
  beforeEach(() => {
    (adminApiModule.getMe as jest.Mock).mockResolvedValue({ role: "admin" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders 2 timeline entries when status_history has 2 items", async () => {
    (adminApiModule.getAdminReport as jest.Mock).mockResolvedValue(STATUS_HISTORY_REPORT);
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    // Each entry renders with a data-status-token dot
    const dots = document.querySelectorAll('[data-status-token]');
    expect(dots.length).toBe(2);
  });

  it("renders the changer name 'Priya Rao' from changed_by_name", async () => {
    (adminApiModule.getAdminReport as jest.Mock).mockResolvedValue(STATUS_HISTORY_REPORT);
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    expect(screen.getByText(/Priya Rao/)).toBeInTheDocument();
  });

  it("does NOT render the literal 'SYSTEM' anywhere in the timeline", async () => {
    (adminApiModule.getAdminReport as jest.Mock).mockResolvedValue(STATUS_HISTORY_REPORT);
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    expect(screen.queryByText(/SYSTEM/)).not.toBeInTheDocument();
  });

  it("renders '—' attribution when changed_by_name is null (not 'SYSTEM')", async () => {
    (adminApiModule.getAdminReport as jest.Mock).mockResolvedValue(STATUS_HISTORY_REPORT);
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    // The entry with null changed_by_name should show "—"
    const dashAttribution = screen.getAllByText(/· BY · —/);
    expect(dashAttribution.length).toBeGreaterThanOrEqual(1);
  });

  it("formatted changed_at date is not 'Invalid Date'", async () => {
    (adminApiModule.getAdminReport as jest.Mock).mockResolvedValue(STATUS_HISTORY_REPORT);
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });

  it("fallback renders single entry with '—' attribution when status_history is empty", async () => {
    const reportWithEmptyHistory = { ...STATUS_HISTORY_REPORT, status_history: [] };
    (adminApiModule.getAdminReport as jest.Mock).mockResolvedValue(reportWithEmptyHistory);
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    // Only one dot in the fallback
    const dots = document.querySelectorAll('[data-status-token]');
    expect(dots.length).toBe(1);
    // Fallback shows "—" not "SYSTEM"
    expect(screen.queryByText(/SYSTEM/)).not.toBeInTheDocument();
    expect(screen.getByText(/· BY · —/)).toBeInTheDocument();
  });

  it("fallback renders single entry when status_history is undefined", async () => {
    const reportWithNoHistory = { ...STATUS_HISTORY_REPORT, status_history: undefined };
    (adminApiModule.getAdminReport as jest.Mock).mockResolvedValue(reportWithNoHistory);
    render(<ReportDetailPage params={{ id: "test-report-id" }} />);
    await screen.findByTestId("report-detail");
    const dots = document.querySelectorAll('[data-status-token]');
    expect(dots.length).toBe(1);
    expect(screen.queryByText(/SYSTEM/)).not.toBeInTheDocument();
  });
});
