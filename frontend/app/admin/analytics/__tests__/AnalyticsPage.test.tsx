/**
 * Wave 0 smoke test for /admin/analytics page.
 *
 * Verifies the page renders without crashing and shows the analytics title.
 * TrendChart and ChoroplethMap are mocked (recharts + Leaflet require DOM/canvas).
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockGetWardAnalytics = jest.fn();
const mockGetCorporationAnalytics = jest.fn();
const mockGetTrendData = jest.fn();

jest.mock("../../lib/adminApi", () => ({
  getWardAnalytics: (...args: unknown[]) => mockGetWardAnalytics(...args),
  getCorporationAnalytics: (...args: unknown[]) => mockGetCorporationAnalytics(...args),
  getTrendData: (...args: unknown[]) => mockGetTrendData(...args),
  getWardBoundaries: jest.fn().mockResolvedValue({ type: "FeatureCollection", features: [] }),
  downloadCsvExport: jest.fn().mockResolvedValue(new Blob()),
  downloadGeoJsonExport: jest.fn().mockResolvedValue(new Blob()),
}));

beforeEach(() => {
  // Default: all API calls succeed with empty data
  mockGetWardAnalytics.mockResolvedValue([]);
  mockGetCorporationAnalytics.mockResolvedValue([]);
  mockGetTrendData.mockResolvedValue([]);
});

jest.mock("../../components/TrendChart", () => {
  const MockTrendChart = () => <div data-testid="trend-chart-mock">TrendChart</div>;
  MockTrendChart.displayName = "TrendChart";
  return MockTrendChart;
});

jest.mock("../ChoroplethMap", () => {
  const MockChoroplethMap = () => <div data-testid="choropleth-map-mock">ChoroplethMap</div>;
  MockChoroplethMap.displayName = "ChoroplethMap";
  return MockChoroplethMap;
});

jest.mock("../../components/KpiCards", () => {
  const MockKpiCards = () => <div data-testid="kpi-cards-mock">KpiCards</div>;
  MockKpiCards.displayName = "KpiCards";
  return MockKpiCards;
});

jest.mock("../../components/WardTable", () => {
  const MockWardTable = () => <div data-testid="ward-table-mock">WardTable</div>;
  MockWardTable.displayName = "WardTable";
  return MockWardTable;
});

// ── Subject under test ────────────────────────────────────────────────────────

import AnalyticsPage from "../page";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AnalyticsPage", () => {
  it("renders the analytics page title without crashing", async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText(/analytics/i)).toBeInTheDocument();
    });
  });

  it("renders KpiCards, WardTable mocks", async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("kpi-cards-mock")).toBeInTheDocument();
      expect(screen.getByTestId("ward-table-mock")).toBeInTheDocument();
    });
  });

  // IN-02: error state coverage — previously untested
  it("displays failure message and retry button when getWardAnalytics rejects", async () => {
    mockGetWardAnalytics.mockRejectedValue(new Error("network error"));

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load analytics data/i)).toBeInTheDocument();
    });

    // Retry button should also be rendered
    expect(screen.getByText(/retry/i)).toBeInTheDocument();
  });
});
