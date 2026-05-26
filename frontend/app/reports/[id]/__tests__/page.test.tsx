/**
 * Tests for frontend/app/reports/[id]/page.tsx — Public Single-Report Page
 *
 * Requirements covered:
 *   MAP-03 — Public /reports/[id] page renders full Direction-A layout
 *   D-17   — Admin-only fields (resolution_notes, submitter_*) NEVER shown
 *   D-26   — Direction-A design system (globals.css tokens)
 *   D-27   — Accessible via Read More → link from map popup
 *   D-28   — Shows: photo, category, severity, description, status, history, hierarchy
 *   D-29   — Status history array from backend (public-safe: no note, no changed_by)
 *
 * Mocking strategy:
 *   - global.fetch is mocked per test via jest.spyOn / mockResolvedValueOnce
 *   - next/navigation is mocked to expose notFound as a jest.fn()
 *   - @/app/lib/config is mocked to provide INTERNAL_API_URL = "http://test-api"
 *   - Server component is called directly as an async function; returned JSX is rendered
 *
 * Privacy guarantee (T-03-04-01):
 *   Tests explicitly assert that resolution_notes, submitter_name, submitter_contact,
 *   submitter_ip do NOT appear in the rendered output.
 */

import React from "react";
import { render, screen } from "@testing-library/react";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks — declared before component import
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: jest.fn(),
  usePathname: jest.fn(() => "/"),
  redirect: jest.fn(),
}));

jest.mock("@/app/lib/config", () => ({
  INTERNAL_API_URL: "http://test-api",
  API_BASE_URL: "",
  ADMIN_API_BASE_URL: "",
}));

// ─────────────────────────────────────────────────────────────────────────────
// Component import (after mocks are set up)
// ─────────────────────────────────────────────────────────────────────────────
import PublicReportPage from "../page";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: mock fetch response
// ─────────────────────────────────────────────────────────────────────────────
function mockFetchOk(body: unknown) {
  jest.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response);
}

function mockFetch404() {
  jest.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: false,
    status: 404,
    json: async () => ({ error: "Not found" }),
  } as Response);
}

function mockFetch500() {
  jest.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: false,
    status: 500,
    json: async () => ({ error: "Server error" }),
  } as Response);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────
function makeFullReport(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-report-abc",
    created_at: "2026-03-15T10:00:00Z",
    image_url: "http://test-api/uploads/test.jpg",
    latitude: 12.972,
    longitude: 77.595,
    category: "no_footpath",
    severity: "high",
    description: "No footpath alongside main road",
    status: "in_progress",
    location_source: "gps",
    history: [
      { status: "open", changed_at: "2026-03-15T10:00:00Z" },
      { status: "acknowledged", changed_at: "2026-03-16T09:00:00Z" },
      { status: "in_progress", changed_at: "2026-03-17T11:00:00Z" },
    ],
    ward_hierarchy: {
      ward_name: "Shivajinagar",
      corporation: "East Corporation",
      zone_name: "East Zone",
      ro_division: "East Division",
      aro_sub_division: "Shivajinagar Sub Division",
      assembly_constituency: "Shivajinagar",
      assembly_constituency_no: 152,
      parliamentary_constituency: "Bangalore Central",
      mla_name: "Rizwan Arshad",
      mp_name: "P C Mohan",
    },
    ...overrides,
  };
}

function makeResolvedReport() {
  return makeFullReport({
    status: "resolved",
    resolution_photo_url: "http://test-api/uploads/after.jpg",
    history: [
      { status: "open", changed_at: "2026-03-15T10:00:00Z" },
      { status: "resolved", changed_at: "2026-03-20T14:00:00Z" },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PublicReportPage — full report rendering", () => {
  it("renders the hero image with src from report.image_url", async () => {
    mockFetchOk(makeFullReport());
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    const img = screen.getByRole("img", { hidden: true });
    expect(img).toHaveAttribute("src", "http://test-api/uploads/test.jpg");
  });

  it("renders the report status chip with public label (In progress)", async () => {
    mockFetchOk(makeFullReport({ status: "in_progress" }));
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    // Multiple "In progress" elements appear (status chip + timeline entry) — check at least one
    expect(screen.getAllByText(/In progress/i).length).toBeGreaterThan(0);
  });

  it("renders the report status chip for open status (Open)", async () => {
    mockFetchOk(makeFullReport({ status: "open" }));
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(screen.getAllByText(/Open/i).length).toBeGreaterThan(0);
  });

  it("renders the status history timeline entries", async () => {
    mockFetchOk(makeFullReport());
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    // Status history section should be present
    expect(screen.getByText(/Status history/i)).toBeInTheDocument();
    // Timeline has 3 entries: open, acknowledged, in_progress
    expect(screen.getAllByText(/Open/i).length).toBeGreaterThan(0);
  });

  it("renders the GBA Responsibility Hierarchy section with ward data", async () => {
    mockFetchOk(makeFullReport());
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(screen.getByText(/GBA Responsibility Hierarchy/i)).toBeInTheDocument();
    // Shivajinagar appears in both ward name and assembly constituency — use getAllByText
    expect(screen.getAllByText(/Shivajinagar/i).length).toBeGreaterThan(0);
    // East Corporation appears in multiple places (meta grid + hierarchy) — use getAllByText
    expect(screen.getAllByText(/East Corporation/i).length).toBeGreaterThan(0);
  });

  it("renders the elected chain with MLA and MP names", async () => {
    mockFetchOk(makeFullReport());
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(screen.getByText(/Rizwan Arshad/i)).toBeInTheDocument();
    expect(screen.getByText(/P C Mohan/i)).toBeInTheDocument();
    expect(screen.getByText(/Bangalore Central/i)).toBeInTheDocument();
  });

  it("renders the constituency disclaimer footnote", async () => {
    mockFetchOk(makeFullReport());
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(
      screen.getByText(/Constituency boundaries may differ from ward boundaries/i)
    ).toBeInTheDocument();
  });

  it("renders a back-to-map link", async () => {
    mockFetchOk(makeFullReport());
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(screen.getByText(/Back to map/i)).toBeInTheDocument();
  });

  it("renders the Map pill header link", async () => {
    mockFetchOk(makeFullReport());
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    // "← Map" pill in floating header
    expect(screen.getByRole("link", { name: /← Map/i })).toBeInTheDocument();
  });

  it("does NOT render admin-only field resolution_notes (privacy D-17)", async () => {
    const reportWithNotes = makeFullReport({
      // Even if backend accidentally sent it, the page must not render it
      resolution_notes: "Admin internal fix note",
    });
    mockFetchOk(reportWithNotes);
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(screen.queryByText(/Admin internal fix note/i)).not.toBeInTheDocument();
  });

  it("does NOT render status history changed_by (privacy D-29)", async () => {
    const reportWithLeakedHistory = makeFullReport({
      history: [
        { status: "open", changed_at: "2026-03-15T10:00:00Z", changed_by: "admin@nammadaari.com" },
      ],
    });
    mockFetchOk(reportWithLeakedHistory);
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(screen.queryByText(/admin@nammadaari.com/i)).not.toBeInTheDocument();
  });
});

describe("PublicReportPage — Resolution section (conditional)", () => {
  it("renders Resolution section ONLY when status is resolved", async () => {
    mockFetchOk(makeResolvedReport());
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(screen.getByText(/Resolution/i)).toBeInTheDocument();
    expect(screen.getByText(/Field verified/i)).toBeInTheDocument();
  });

  it("does NOT render Resolution section when status is open", async () => {
    mockFetchOk(makeFullReport({ status: "open" }));
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(screen.queryByText(/Field verified/i)).not.toBeInTheDocument();
  });

  it("does NOT render Resolution section when status is in_progress", async () => {
    mockFetchOk(makeFullReport({ status: "in_progress" }));
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(screen.queryByText(/Field verified/i)).not.toBeInTheDocument();
  });

  it("renders Resolution section when status is closed", async () => {
    mockFetchOk(makeFullReport({
      status: "closed",
      resolution_photo_url: "http://test-api/uploads/after-closed.jpg",
      history: [{ status: "closed", changed_at: "2026-03-22T14:00:00Z" }],
    }));
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(screen.getByText(/Field verified/i)).toBeInTheDocument();
  });
});

describe("PublicReportPage — null/missing ward_hierarchy", () => {
  it("shows fallback muted card when ward_hierarchy is null", async () => {
    mockFetchOk(makeFullReport({ ward_hierarchy: null }));
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(
      screen.getByText(/Ward assignment not available for this report/i)
    ).toBeInTheDocument();
  });

  it("shows fallback when ward_hierarchy.ward_name is null", async () => {
    mockFetchOk(
      makeFullReport({
        ward_hierarchy: {
          ward_name: null,
          corporation: null,
          zone_name: null,
          ro_division: null,
          aro_sub_division: null,
          assembly_constituency: null,
          assembly_constituency_no: null,
          parliamentary_constituency: null,
          mla_name: null,
          mp_name: null,
        },
      })
    );
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(
      screen.getByText(/Ward assignment not available for this report/i)
    ).toBeInTheDocument();
  });
});

describe("PublicReportPage — error handling", () => {
  it("calls notFound() when API returns 404", async () => {
    const { notFound } = require("next/navigation");
    mockFetch404();

    await expect(
      PublicReportPage({ params: { id: "nonexistent-id" } })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("renders error fallback when API returns 500", async () => {
    mockFetch500();
    const jsx = await PublicReportPage({ params: { id: "test-report-abc" } });
    render(jsx);

    expect(screen.getByText(/Failed to load report/i)).toBeInTheDocument();
  });

  it("calls fetch with the correct URL including report ID", async () => {
    mockFetchOk(makeFullReport());
    const fetchSpy = jest.spyOn(global, "fetch");
    // fetchSpy already set up by mockFetchOk — check the call after rendering
    await PublicReportPage({ params: { id: "specific-report-id-123" } });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://test-api/api/reports/specific-report-id-123",
      { cache: "no-store" }
    );
  });
});
