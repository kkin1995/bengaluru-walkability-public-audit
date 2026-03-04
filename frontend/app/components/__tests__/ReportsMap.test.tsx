/**
 * Tests for frontend/app/components/ReportsMap.tsx
 *
 * Requirements covered:
 *   R5 — Public Map
 *   AC5.1 — Reports load on mount and render as CircleMarker elements
 *   AC5.2 — lat/lng rounded to 3 decimal places in API response (API contract, tested via data passed through)
 *   AC5.3 — Clicking marker shows popup with photo, category, severity, description, date
 *   AC5.4 — Fetch fail → inline error message + Retry button shown
 *   AC5.5 — 0 reports → empty state message shown
 *
 * Mocking strategy:
 *   - react-leaflet is mocked globally via __mocks__/reactLeaflet.js — MapContainer,
 *     TileLayer, CircleMarker, Popup are all simple divs with data-testid attributes.
 *   - leaflet is mocked globally via __mocks__/leaflet.js — prevents L.Icon errors.
 *   - fetch is mocked via jest.spyOn(global, "fetch") in each describe block.
 *   - All dates are fixed strings to ensure determinism.
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportsMap from "../ReportsMap";

const API_URL = "http://localhost:3001";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture factories
// ─────────────────────────────────────────────────────────────────────────────
function makeReport(overrides: Partial<{
  id: string;
  latitude: number;
  longitude: number;
  category: string;
  severity: string;
  description: string;
  image_url: string;
  created_at: string;
  status: string;
}> = {}) {
  return {
    id: "report-uuid-001",
    latitude: 12.972,        // already 3 decimal places — AC5.2 contract from API
    longitude: 77.595,
    category: "no_footpath",
    severity: "high",
    description: "Large open drain, very dangerous",
    image_url: "http://localhost:3001/uploads/abc.jpg",
    created_at: "2026-03-01T10:00:00Z",
    status: "new",
    ...overrides,
  };
}

function mockFetchSuccess(items: ReturnType<typeof makeReport>[]) {
  jest.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: true,
    json: async () => ({ page: 1, limit: 200, count: items.length, items }),
  } as Response);
}

function mockFetchFailure() {
  jest.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: false,
    status: 500,
    json: async () => ({}),
  } as Response);
}

function mockFetchNetworkError() {
  jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));
}

// ─────────────────────────────────────────────────────────────────────────────
// R5 / AC5.1 — Reports load on mount
// ─────────────────────────────────────────────────────────────────────────────
describe("R5 / AC5.1 — Reports load on mount", () => {
  it("shows 'Loading reports…' while fetch is in progress", async () => {
    // Never-resolving fetch simulates pending state
    jest.spyOn(global, "fetch").mockReturnValueOnce(new Promise(() => {}));

    render(<ReportsMap apiUrl={API_URL} />);

    expect(screen.getByText("Loading reports…")).toBeInTheDocument();
  });

  it("calls fetch with the correct URL on mount — AC5.1", async () => {
    mockFetchSuccess([]);
    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/api/reports?limit=200`
      );
    });
  });

  it("renders a CircleMarker for each report in the response — AC5.1", async () => {
    const reports = [
      makeReport({ id: "r1", latitude: 12.971, longitude: 77.594 }),
      makeReport({ id: "r2", latitude: 12.980, longitude: 77.600 }),
    ];
    mockFetchSuccess(reports);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      const markers = screen.getAllByTestId("circle-marker");
      expect(markers).toHaveLength(2);
    });
  });

  it("passes latitude and longitude to CircleMarker center — AC5.1", async () => {
    mockFetchSuccess([makeReport({ latitude: 12.972, longitude: 77.595 })]);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      const marker = screen.getByTestId("circle-marker");
      expect(marker).toHaveAttribute("data-lat", "12.972");
      expect(marker).toHaveAttribute("data-lng", "77.595");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R5 / AC5.2 — lat/lng are the values returned by the API (3 decimal places)
// The rounding itself is a backend responsibility tested in Rust unit tests.
// Here we verify the frontend passes the values through without further mutation.
// ─────────────────────────────────────────────────────────────────────────────
describe("R5 / AC5.2 — Frontend passes API lat/lng to markers without modification", () => {
  it("renders marker at exactly the lat/lng from the API payload", async () => {
    // API already returns 3-decimal-place values per AC5.2 contract
    mockFetchSuccess([makeReport({ latitude: 12.971, longitude: 77.594 })]);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      const marker = screen.getByTestId("circle-marker");
      // Marker must reflect API values exactly — no client-side rounding
      expect(marker.getAttribute("data-lat")).toBe("12.971");
      expect(marker.getAttribute("data-lng")).toBe("77.594");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R5 / AC5.3 — Popup shows photo, category label, severity, description, date
// ─────────────────────────────────────────────────────────────────────────────
describe("R5 / AC5.3 — Popup content", () => {
  it("renders a Popup for each report — AC5.3", async () => {
    mockFetchSuccess([makeReport()]);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(screen.getByTestId("popup")).toBeInTheDocument();
    });
  });

  it("popup shows the human-readable category label, not the raw value — AC5.3", async () => {
    mockFetchSuccess([makeReport({ category: "no_footpath" })]);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      // "No Footpath" is the label for no_footpath
      expect(screen.getByText("No Footpath")).toBeInTheDocument();
    });
  });

  it("popup shows severity — AC5.3", async () => {
    mockFetchSuccess([makeReport({ severity: "high" })]);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(screen.getByText(/severity:\s*high/i)).toBeInTheDocument();
    });
  });

  it("popup shows description when present — AC5.3", async () => {
    mockFetchSuccess([
      makeReport({ description: "Large open drain, very dangerous" }),
    ]);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(
        screen.getByText("Large open drain, very dangerous")
      ).toBeInTheDocument();
    });
  });

  it("popup does NOT show description element when description is absent — AC5.3", async () => {
    const report = makeReport();
    // Remove description
    const { description: _removed, ...reportWithoutDesc } = report;
    mockFetchSuccess([reportWithoutDesc as ReturnType<typeof makeReport>]);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      // Popup should render but not include any description paragraph
      expect(screen.queryByText("Large open drain, very dangerous")).not.toBeInTheDocument();
    });
  });

  it("popup shows the image with the image_url from the API — AC5.3", async () => {
    mockFetchSuccess([
      makeReport({ image_url: "http://localhost:3001/uploads/abc.jpg" }),
    ]);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      const img = screen.getByAltText("Report photo");
      expect(img).toHaveAttribute("src", "http://localhost:3001/uploads/abc.jpg");
    });
  });

  it("popup shows a formatted date for created_at — AC5.3", async () => {
    // 2026-03-01T10:00:00Z should render as a date string (locale: en-IN)
    mockFetchSuccess([makeReport({ created_at: "2026-03-01T10:00:00Z" })]);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      // The exact locale string varies by environment; assert it contains "2026"
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });
  });

  it("popup shows category label for all known categories — AC5.3", async () => {
    const categoryLabelPairs = [
      { category: "no_footpath", label: "No Footpath" },
      { category: "broken_footpath", label: "Damaged Footpath" },
      { category: "blocked_footpath", label: "Blocked Footpath" },
      { category: "unsafe_crossing", label: "Unsafe Crossing" },
      { category: "poor_lighting", label: "Poor Lighting" },
      { category: "other", label: "Other Issue" },
    ];

    for (const { category, label } of categoryLabelPairs) {
      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [makeReport({ id: `r-${category}`, category })],
        }),
      } as Response);

      const { unmount } = render(<ReportsMap apiUrl={API_URL} />);

      await waitFor(() => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });

      unmount();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R5 / AC5.4 — Fetch fail → inline error + Retry button
// ─────────────────────────────────────────────────────────────────────────────
describe("R5 / AC5.4 — Fetch failure shows error and retry button", () => {
  it("shows error message when the server returns a non-ok response — AC5.4", async () => {
    mockFetchFailure();

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't load reports — tap to retry.")
      ).toBeInTheDocument();
    });
  });

  it("shows error message when fetch throws (network error) — AC5.4", async () => {
    mockFetchNetworkError();

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't load reports — tap to retry.")
      ).toBeInTheDocument();
    });
  });

  it("shows a Retry button after a fetch failure — AC5.4", async () => {
    mockFetchFailure();

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  it("clicking Retry re-calls fetch and shows loading state — AC5.4", async () => {
    // First call fails; second call never resolves (so we can assert loading)
    mockFetchFailure();

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    // Second fetch never resolves — simulates ongoing reload
    jest.spyOn(global, "fetch").mockReturnValueOnce(new Promise(() => {}));

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    });

    expect(screen.getByText("Loading reports…")).toBeInTheDocument();
  });

  it("clicking Retry clears the error message — AC5.4", async () => {
    mockFetchFailure();

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    // Second fetch succeeds with empty list
    mockFetchSuccess([]);

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Couldn't load reports — tap to retry.")
      ).not.toBeInTheDocument();
    });
  });

  it("does NOT show the map container during the error state — AC5.4", async () => {
    mockFetchFailure();

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't load reports — tap to retry.")
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId("map-container")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R5 / AC5.5 — 0 reports → empty state message shown
// ─────────────────────────────────────────────────────────────────────────────
describe("R5 / AC5.5 — Empty state when there are no reports", () => {
  it("shows empty state message when API returns 0 reports — AC5.5", async () => {
    mockFetchSuccess([]);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No reports yet. Be the first to report an issue."
        )
      ).toBeInTheDocument();
    });
  });

  it("still renders the map container when there are 0 reports — AC5.5", async () => {
    mockFetchSuccess([]);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(screen.getByTestId("map-container")).toBeInTheDocument();
    });
  });

  it("does NOT show the empty state when there are reports — AC5.5 (no false positive)", async () => {
    mockFetchSuccess([makeReport()]);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(
        screen.queryByText("No reports yet. Be the first to report an issue.")
      ).not.toBeInTheDocument();
    });
  });

  it("does NOT render any CircleMarker when report list is empty — AC5.5", async () => {
    mockFetchSuccess([]);

    render(<ReportsMap apiUrl={API_URL} />);

    await waitFor(() => {
      expect(screen.queryByTestId("circle-marker")).not.toBeInTheDocument();
    });
  });
});
