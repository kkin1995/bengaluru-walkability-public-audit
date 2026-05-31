/**
 * Wave 0 tests for HeatmapLayer component (MAP-02 / D-02 / D-03).
 *
 * Verifies:
 *   - Only open/unresolved reports reach L.heatLayer (D-02 filter)
 *   - Component renders without crashing inside a map context
 *   - leaflet.heat side-effect import does not throw
 *
 * Does not require a real DOM or Leaflet — leaflet and react-leaflet are mocked.
 */

import React from "react";
import { render } from "@testing-library/react";
import L from "leaflet";
import HeatmapLayer from "../../HeatmapLayer";

// Mock leaflet.heat as a no-op side effect (the mock is in __mocks__/leaflet.js
// which already adds heatLayer to the mock L object).
jest.mock("leaflet.heat", () => ({}), { virtual: true });

// react-leaflet is mocked via moduleNameMapper in jest.config.js (reactLeaflet.js)
// useMap() returns a mock map object.
const mockMap = {
  removeControl: jest.fn(),
  removeLayer: jest.fn(),
  hasLayer: jest.fn(() => false),
  addControl: jest.fn(),
};

jest.mock("react-leaflet", () => ({
  useMap: () => mockMap,
}));

const REPORTS = [
  { latitude: 12.971, longitude: 77.594, status: "open" },
  { latitude: 12.972, longitude: 77.595, status: "open" },
  { latitude: 12.973, longitude: 77.596, status: "resolved" },   // should be filtered out
  { latitude: 12.974, longitude: 77.597, status: "in_progress" }, // should be filtered out
  { latitude: 12.975, longitude: 77.598, status: "closed" },      // should be filtered out
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe("HeatmapLayer", () => {
  it("renders without crashing inside a map context", () => {
    expect(() => render(<HeatmapLayer reports={REPORTS} />)).not.toThrow();
  });

  it("passes only open reports to L.heatLayer (D-02 filter)", () => {
    render(<HeatmapLayer reports={REPORTS} />);

    expect((L as any).heatLayer).toHaveBeenCalledTimes(1);
    const [points] = (L as any).heatLayer.mock.calls[0];

    // Only the 2 open reports should be in the heat points
    expect(points).toHaveLength(2);

    // Each point is [lat, lng, intensity]
    expect(points[0]).toEqual([12.971, 77.594, 1.0]);
    expect(points[1]).toEqual([12.972, 77.595, 1.0]);
  });

  it("filters out resolved, in_progress, and closed reports", () => {
    render(<HeatmapLayer reports={REPORTS} />);

    const [points] = (L as any).heatLayer.mock.calls[0];
    const lats = points.map((p: number[]) => p[0]);

    // resolved (12.973), in_progress (12.974), closed (12.975) must NOT appear
    expect(lats).not.toContain(12.973);
    expect(lats).not.toContain(12.974);
    expect(lats).not.toContain(12.975);
  });

  it("registers the heatmap via L.control.layers (D-03)", () => {
    render(<HeatmapLayer reports={REPORTS} />);

    expect(L.control.layers).toHaveBeenCalledTimes(1);
    const [, overlays] = (L.control.layers as jest.Mock).mock.calls[0];
    expect(overlays).toHaveProperty("Issue Density");
  });

  it("renders null (no visible DOM element)", () => {
    const { container } = render(<HeatmapLayer reports={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
