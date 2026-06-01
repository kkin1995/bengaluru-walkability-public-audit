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

// WR-06: UNRESOLVED_STATUSES = { open, acknowledged, assigned, in_progress }.
// Only "resolved" and "closed" are excluded from the heatmap.
const REPORTS = [
  { latitude: 12.971, longitude: 77.594, status: "open" },
  { latitude: 12.972, longitude: 77.595, status: "open" },
  { latitude: 12.973, longitude: 77.596, status: "resolved" },     // should be filtered out
  { latitude: 12.974, longitude: 77.597, status: "in_progress" },  // should be INCLUDED
  { latitude: 12.975, longitude: 77.598, status: "closed" },       // should be filtered out
  { latitude: 12.976, longitude: 77.599, status: "acknowledged" }, // should be INCLUDED
  { latitude: 12.977, longitude: 77.600, status: "assigned" },     // should be INCLUDED
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe("HeatmapLayer", () => {
  it("renders without crashing inside a map context", () => {
    expect(() => render(<HeatmapLayer reports={REPORTS} />)).not.toThrow();
  });

  it("passes all unresolved reports (open/acknowledged/assigned/in_progress) to L.heatLayer (D-02 filter)", () => {
    render(<HeatmapLayer reports={REPORTS} />);

    expect((L as any).heatLayer).toHaveBeenCalledTimes(1);
    const [points] = (L as any).heatLayer.mock.calls[0];

    // 5 unresolved reports: 2 open + 1 in_progress + 1 acknowledged + 1 assigned
    expect(points).toHaveLength(5);

    // Each point is [lat, lng, intensity]
    const lats = points.map((p: number[]) => p[0]);
    expect(lats).toContain(12.971); // open
    expect(lats).toContain(12.972); // open
    expect(lats).toContain(12.974); // in_progress — included per UNRESOLVED_STATUSES
    expect(lats).toContain(12.976); // acknowledged — included per UNRESOLVED_STATUSES
    expect(lats).toContain(12.977); // assigned — included per UNRESOLVED_STATUSES
  });

  it("filters out only resolved and closed reports", () => {
    render(<HeatmapLayer reports={REPORTS} />);

    const [points] = (L as any).heatLayer.mock.calls[0];
    const lats = points.map((p: number[]) => p[0]);

    // Only "resolved" (12.973) and "closed" (12.975) must NOT appear
    expect(lats).not.toContain(12.973); // resolved
    expect(lats).not.toContain(12.975); // closed
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
