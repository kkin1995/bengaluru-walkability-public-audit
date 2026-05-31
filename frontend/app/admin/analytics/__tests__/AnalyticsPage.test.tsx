/**
 * Wave 0 smoke test for /admin/analytics page.
 *
 * Verifies the page renders without crashing and shows the analytics title.
 * TrendChart and ChoroplethMap are mocked (recharts + Leaflet require DOM/canvas).
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock("../../lib/adminApi", () => ({
  getWardAnalytics: jest.fn().mockResolvedValue([]),
  getCorporationAnalytics: jest.fn().mockResolvedValue([]),
  getTrendData: jest.fn().mockResolvedValue([]),
  getWardBoundaries: jest.fn().mockResolvedValue({ type: "FeatureCollection", features: [] }),
  downloadCsvExport: jest.fn().mockResolvedValue(new Blob()),
  downloadGeoJsonExport: jest.fn().mockResolvedValue(new Blob()),
}));

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
});
