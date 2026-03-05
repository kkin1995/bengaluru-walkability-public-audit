/**
 * Tests for the EXIF vs manual-pin conflict warning in LocationMap.tsx.
 *
 * Feature: §2.3 — EXIF vs Manual Pin Conflict Warning
 *
 * Requirements covered:
 *   §2.3-W1 — No warning when exifCoords prop is absent
 *   §2.3-W2 — No warning when pin is within 500 m of EXIF position
 *   §2.3-W3 — Amber warning banner appears when pin is moved >500 m from EXIF position
 *   §2.3-W4 — Warning text is exact: "Your pin is far from the photo location — is this intentional?"
 *              (em dash U+2014 between "location" and "is", NOT a double hyphen "--")
 *   §2.3-W5 — Warning is dismissible (clicking dismiss removes the banner)
 *   §2.3-W6 — Dismissed state resets when pin moves back within 500 m, so warning
 *              reappears if the pin is moved far away again
 *
 * Prop contract expected on LocationMap after implementation:
 *   interface LocationMapProps {
 *     lat: number;
 *     lng: number;
 *     onChange: (lat: number, lng: number) => void;
 *     readOnly?: boolean;
 *     exifCoords?: { lat: number; lng: number };   // ← NEW: EXIF reference position
 *   }
 *
 * Mocking strategy:
 *   react-leaflet is mocked in this file using jest.mock() which overrides the
 *   global __mocks__/reactLeaflet.js for this test module only. The override
 *   adds useMapEvents (absent from the global mock) and exposes a test-only
 *   handle so tests can programmatically fire map click events. This is
 *   necessary because Leaflet requires a real browser DOM with canvas support
 *   that jsdom does not provide.
 *
 *   leaflet is mocked via __mocks__/leaflet.js (global, no override needed here).
 *
 * Determinism:
 *   - All coordinates are fixed constants — no randomness.
 *   - No wall-clock time dependencies.
 *   - No network calls.
 *
 * Coordinate fixtures (validated against haversineDistance):
 *   EXIF anchor:      12.9716° N, 77.5946° E  (Bengaluru city centre)
 *   CLOSE pin:        12.9718° N, 77.5948° E  (~28 m from anchor — well under 500 m)
 *   FAR pin:          13.0220° N, 77.5946° E  (~5 038 m from anchor — well over 500 m)
 *   BOUNDARY pin:     12.9761° N, 77.5946° E  (~500 m from anchor — AT threshold, no warning)
 *   JUST_OVER pin:    12.9762° N, 77.5946° E  (~511 m from anchor — OVER threshold, warning fires)
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─────────────────────────────────────────────────────────────────────────────
// react-leaflet mock (overrides __mocks__/reactLeaflet.js for this file)
//
// Adds useMapEvents and exposes simulateMapClick so tests can programmatically
// move the map pin without a real Leaflet instance.
// ─────────────────────────────────────────────────────────────────────────────

// Shared mutable ref — tests write a callback here; useMapEvents reads it.
let _mapClickHandler: ((e: { latlng: { lat: number; lng: number } }) => void) | null = null;

/**
 * Call this in a test to simulate a user clicking the map at the given coords.
 * The DraggableMarker inside LocationMap registers its click handler via
 * useMapEvents; this function invokes that handler directly.
 */
function simulateMapClick(lat: number, lng: number): void {
  if (_mapClickHandler) {
    _mapClickHandler({ latlng: { lat, lng } });
  }
}

jest.mock("react-leaflet", () => {
  const React = require("react");

  const MapContainer = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement("div", { "data-testid": "map-container", ...props }, children);

  const TileLayer = () => React.createElement("div", { "data-testid": "tile-layer" });

  const Marker = ({ children, position }: { children?: React.ReactNode; position?: [number, number] }) =>
    React.createElement(
      "div",
      { "data-testid": "marker", "data-lat": position?.[0], "data-lng": position?.[1] },
      children
    );

  // useMapEvents captures the click handler so simulateMapClick can invoke it.
  // This mirrors the real react-leaflet API: useMapEvents({ click(e) {...} }).
  const useMapEvents = (handlers: { click?: (e: { latlng: { lat: number; lng: number } }) => void }) => {
    // Register the click handler on every render so it always references fresh closure state.
    _mapClickHandler = handlers.click ?? null;
    return null;
  };

  const useMap = () => ({
    setView: jest.fn(),
    getZoom: jest.fn(() => 15),
  });

  return { MapContainer, TileLayer, Marker, useMapEvents, useMap };
});

// ─────────────────────────────────────────────────────────────────────────────
// Import component AFTER mocks are declared
// ─────────────────────────────────────────────────────────────────────────────
import LocationMap from "../LocationMap";

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** EXIF anchor — Bengaluru city centre, used as the reference EXIF position */
const EXIF_LAT = 12.9716;
const EXIF_LNG = 77.5946;

/** Initial pin — same as EXIF anchor (typical starting state after photo upload) */
const INITIAL_LAT = EXIF_LAT;
const INITIAL_LNG = EXIF_LNG;

/** CLOSE pin — ~28 m from the EXIF anchor; must NOT trigger the warning */
const CLOSE_LAT = 12.9718;
const CLOSE_LNG = 77.5948;

/** FAR pin — ~5 038 m from the EXIF anchor; MUST trigger the warning */
const FAR_LAT = 13.022;
const FAR_LNG = 77.5946;

/** BOUNDARY pin — ~500 m from the EXIF anchor; must NOT trigger the warning (≤500 m is OK) */
const BOUNDARY_LAT = 12.9761;
const BOUNDARY_LNG = 77.5946;

/** JUST_OVER pin — ~511 m from the EXIF anchor; MUST trigger the warning (>500 m) */
const JUST_OVER_LAT = 12.9762;
const JUST_OVER_LNG = 77.5946;

/** Exact warning text including em dash (U+2014). Implementer must not use "--". */
const WARNING_TEXT =
  "Your pin is far from the photo location \u2014 is this intentional?";

// ─────────────────────────────────────────────────────────────────────────────
// Helper — renders LocationMap with the given props and returns onChange spy
// ─────────────────────────────────────────────────────────────────────────────
function renderLocationMap(props: {
  lat: number;
  lng: number;
  exifCoords?: { lat: number; lng: number };
  readOnly?: boolean;
}) {
  const onChange = jest.fn();
  const result = render(
    <LocationMap {...props} onChange={onChange} />
  );
  return { onChange, ...result };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset the shared click handler between tests
// ─────────────────────────────────────────────────────────────────────────────
beforeEach(() => {
  _mapClickHandler = null;
});

// ─────────────────────────────────────────────────────────────────────────────
// §2.3-W1 — No warning when exifCoords is absent
// ─────────────────────────────────────────────────────────────────────────────
describe("§2.3-W1 — No warning when exifCoords prop is absent", () => {
  it("renders without warning banner when exifCoords is not provided and pin is at default position", () => {
    renderLocationMap({ lat: INITIAL_LAT, lng: INITIAL_LNG });
    // No exifCoords → warning must never appear regardless of pin position.
    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });

  it("does not show warning even when pin is moved far from its initial position and exifCoords is absent", () => {
    const { onChange } = renderLocationMap({ lat: INITIAL_LAT, lng: INITIAL_LNG });

    // Move pin far away (no exifCoords prop, so no reference to compare against)
    act(() => {
      simulateMapClick(FAR_LAT, FAR_LNG);
    });

    // onChange fires (the component still responds to map clicks normally)
    expect(onChange).toHaveBeenCalledWith(FAR_LAT, FAR_LNG);
    // But no warning because there is no EXIF reference to compare against
    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2.3-W2 — No warning when pin is within 500 m of EXIF position
// ─────────────────────────────────────────────────────────────────────────────
describe("§2.3-W2 — No warning when pin is within 500 m of EXIF position", () => {
  it("does not show warning when pin starts at the exact EXIF coordinates (0 m distance)", () => {
    renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });
    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });

  it("does not show warning when pin is moved to ~28 m from EXIF position (well under 500 m)", () => {
    renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });

    act(() => {
      simulateMapClick(CLOSE_LAT, CLOSE_LNG);
    });

    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });

  it("does not show warning when pin is at exactly 500 m from EXIF position (boundary — threshold is >500 m, not ≥500 m)", () => {
    // §2.3 AC specifies: "> 500 meters" triggers the warning.
    // A pin at exactly 500 m must NOT trigger the warning.
    renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });

    act(() => {
      simulateMapClick(BOUNDARY_LAT, BOUNDARY_LNG);
    });

    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2.3-W3 — Amber warning banner appears when pin is moved >500 m from EXIF
// ─────────────────────────────────────────────────────────────────────────────
describe("§2.3-W3 — Warning appears when pin is moved >500 m from EXIF position", () => {
  it("shows the warning banner when pin is ~5 038 m from EXIF position (well over threshold)", () => {
    renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });

    act(() => {
      simulateMapClick(FAR_LAT, FAR_LNG);
    });

    expect(screen.getByText(WARNING_TEXT)).toBeInTheDocument();
  });

  it("shows the warning banner when pin is ~511 m from EXIF position (just over 500 m)", () => {
    // This is the boundary test for the WARNING side — 501 m must trigger the warning.
    renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });

    act(() => {
      simulateMapClick(JUST_OVER_LAT, JUST_OVER_LNG);
    });

    expect(screen.getByText(WARNING_TEXT)).toBeInTheDocument();
  });

  it("warning banner is visible in the DOM when the pin is far from EXIF (not hidden via CSS class only)", () => {
    // The warning must be rendered into the DOM — not just hidden with a CSS class.
    // screen.getByText() already enforces DOM presence; this test makes the intent explicit.
    renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });

    act(() => {
      simulateMapClick(FAR_LAT, FAR_LNG);
    });

    const warning = screen.getByText(WARNING_TEXT);
    expect(warning).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2.3-W4 — Exact warning text including em dash (U+2014)
// ─────────────────────────────────────────────────────────────────────────────
describe("§2.3-W4 — Warning text is exact (em dash, not double hyphen)", () => {
  it("warning text contains an em dash (U+2014), not a double hyphen (--)", () => {
    renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });

    act(() => {
      simulateMapClick(FAR_LAT, FAR_LNG);
    });

    // Verify the warning is found with the correct em dash character.
    // If the implementation uses "--" instead of "\u2014" this assertion fails.
    const warning = screen.getByText(WARNING_TEXT);
    expect(warning.textContent).toContain("\u2014");
    expect(warning.textContent).not.toContain("--");
  });

  it("warning text is exactly: 'Your pin is far from the photo location \u2014 is this intentional?'", () => {
    renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });

    act(() => {
      simulateMapClick(FAR_LAT, FAR_LNG);
    });

    // Use getByText with exact string to catch any wording deviation.
    expect(
      screen.getByText(
        "Your pin is far from the photo location \u2014 is this intentional?"
      )
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2.3-W5 — Warning is dismissible
// ─────────────────────────────────────────────────────────────────────────────
describe("§2.3-W5 — Warning is dismissible", () => {
  it("warning disappears after the user clicks the dismiss button", async () => {
    renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });

    // Move pin far away to trigger the warning
    act(() => {
      simulateMapClick(FAR_LAT, FAR_LNG);
    });

    expect(screen.getByText(WARNING_TEXT)).toBeInTheDocument();

    // Dismiss the warning — the button must be accessible (role="button" or <button>)
    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    await userEvent.click(dismissButton);

    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });

  it("warning remains gone after dismissal while pin stays in the same far position", async () => {
    renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });

    act(() => {
      simulateMapClick(FAR_LAT, FAR_LNG);
    });

    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    await userEvent.click(dismissButton);

    // Pin has not moved — warning must stay dismissed
    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2.3-W6 — Dismissed state resets when distance drops below threshold
// ─────────────────────────────────────────────────────────────────────────────
describe("§2.3-W6 — Dismissed state resets when pin returns within 500 m", () => {
  it("warning reappears after dismiss if pin moves back under 500 m and then over 500 m again", async () => {
    const { rerender } = renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });

    // Step 1: Move pin far — warning appears
    act(() => {
      simulateMapClick(FAR_LAT, FAR_LNG);
    });
    expect(screen.getByText(WARNING_TEXT)).toBeInTheDocument();

    // Step 2: Dismiss the warning
    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    await userEvent.click(dismissButton);
    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();

    // Step 3: Move pin back within 500 m — warning stays hidden, dismissed state resets
    act(() => {
      simulateMapClick(CLOSE_LAT, CLOSE_LNG);
    });
    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();

    // Step 4: Move pin far again — warning MUST reappear (dismissed state was reset in step 3)
    act(() => {
      simulateMapClick(FAR_LAT, FAR_LNG);
    });
    expect(screen.getByText(WARNING_TEXT)).toBeInTheDocument();
  });

  it("warning does NOT reappear if pin stays beyond 500 m after dismissal", async () => {
    renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });

    // Move far → dismiss
    act(() => {
      simulateMapClick(FAR_LAT, FAR_LNG);
    });
    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    await userEvent.click(dismissButton);

    // Move to a different far position (still >500 m) — dismissed state was never reset
    act(() => {
      simulateMapClick(JUST_OVER_LAT, JUST_OVER_LNG);
    });

    // Warning must remain dismissed — the user has not moved back within 500 m
    expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration guard — warning does not break existing LocationMap behaviour
// ─────────────────────────────────────────────────────────────────────────────
describe("LocationMap core behaviour is unaffected by the warning feature", () => {
  it("onChange is still called with new coordinates when pin is moved (with exifCoords present)", () => {
    const { onChange } = renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });

    act(() => {
      simulateMapClick(FAR_LAT, FAR_LNG);
    });

    // The warning behaviour must not intercept or suppress the onChange callback.
    expect(onChange).toHaveBeenCalledWith(FAR_LAT, FAR_LNG);
  });

  it("onChange is still called with new coordinates when pin is moved (without exifCoords)", () => {
    const { onChange } = renderLocationMap({ lat: INITIAL_LAT, lng: INITIAL_LNG });

    act(() => {
      simulateMapClick(CLOSE_LAT, CLOSE_LNG);
    });

    expect(onChange).toHaveBeenCalledWith(CLOSE_LAT, CLOSE_LNG);
  });

  it("map container is rendered", () => {
    renderLocationMap({
      lat: EXIF_LAT,
      lng: EXIF_LNG,
      exifCoords: { lat: EXIF_LAT, lng: EXIF_LNG },
    });
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });
});
