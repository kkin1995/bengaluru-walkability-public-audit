/**
 * Tests for frontend/app/lib/constants.ts
 *
 * Requirements covered:
 *   R2 (Location Confirmation) — the bbox constants drive isInBengaluru()
 *   AC2.2 — pin outside bbox → Next disabled + error (bbox values tested here)
 */

import { BENGALURU_BOUNDS, BENGALURU_CENTER } from "../constants";

// ─────────────────────────────────────────────────────────────────────────────
// R2 / AC2.2 — BENGALURU_BOUNDS shape and exact values
// ─────────────────────────────────────────────────────────────────────────────
describe("BENGALURU_BOUNDS", () => {
  it("exports latMin as 12.7342 (AC2.2 — southern boundary)", () => {
    expect(BENGALURU_BOUNDS.latMin).toBe(12.7342);
  });

  it("exports latMax as 13.1739 (AC2.2 — northern boundary)", () => {
    expect(BENGALURU_BOUNDS.latMax).toBe(13.1739);
  });

  it("exports lngMin as 77.3791 (AC2.2 — western boundary)", () => {
    expect(BENGALURU_BOUNDS.lngMin).toBe(77.3791);
  });

  it("exports lngMax as 77.8731 (AC2.2 — eastern boundary)", () => {
    expect(BENGALURU_BOUNDS.lngMax).toBe(77.8731);
  });

  it("latMin is less than latMax — bbox is non-degenerate north-south", () => {
    expect(BENGALURU_BOUNDS.latMin).toBeLessThan(BENGALURU_BOUNDS.latMax);
  });

  it("lngMin is less than lngMax — bbox is non-degenerate east-west", () => {
    expect(BENGALURU_BOUNDS.lngMin).toBeLessThan(BENGALURU_BOUNDS.lngMax);
  });

  it("BENGALURU_CENTER.lat is within the latitude bounds — center must be inside", () => {
    expect(BENGALURU_CENTER.lat).toBeGreaterThanOrEqual(BENGALURU_BOUNDS.latMin);
    expect(BENGALURU_CENTER.lat).toBeLessThanOrEqual(BENGALURU_BOUNDS.latMax);
  });

  it("BENGALURU_CENTER.lng is within the longitude bounds — center must be inside", () => {
    expect(BENGALURU_CENTER.lng).toBeGreaterThanOrEqual(BENGALURU_BOUNDS.lngMin);
    expect(BENGALURU_CENTER.lng).toBeLessThanOrEqual(BENGALURU_BOUNDS.lngMax);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BENGALURU_CENTER exact values
// ─────────────────────────────────────────────────────────────────────────────
describe("BENGALURU_CENTER", () => {
  it("exports lat as 12.9716", () => {
    expect(BENGALURU_CENTER.lat).toBe(12.9716);
  });

  it("exports lng as 77.5946", () => {
    expect(BENGALURU_CENTER.lng).toBe(77.5946);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isInBengaluru logic — validated using the exported constants directly.
// This mirrors the helper defined in report/page.tsx to confirm the constants
// produce correct boolean outcomes at boundary values.
// ─────────────────────────────────────────────────────────────────────────────
function isInBengaluru(lat: number, lng: number): boolean {
  return (
    lat >= BENGALURU_BOUNDS.latMin &&
    lat <= BENGALURU_BOUNDS.latMax &&
    lng >= BENGALURU_BOUNDS.lngMin &&
    lng <= BENGALURU_BOUNDS.lngMax
  );
}

describe("isInBengaluru (boundary value tests)", () => {
  // ── Exact boundary corners ─────────────────────────────────────────────────
  it("accepts the exact SW corner (latMin, lngMin) — AC2.2 boundary inclusive", () => {
    expect(isInBengaluru(12.7342, 77.3791)).toBe(true);
  });

  it("accepts the exact NE corner (latMax, lngMax) — AC2.2 boundary inclusive", () => {
    expect(isInBengaluru(13.1739, 77.8731)).toBe(true);
  });

  it("accepts the exact NW corner (latMax, lngMin)", () => {
    expect(isInBengaluru(13.1739, 77.3791)).toBe(true);
  });

  it("accepts the exact SE corner (latMin, lngMax)", () => {
    expect(isInBengaluru(12.7342, 77.8731)).toBe(true);
  });

  // ── Center ─────────────────────────────────────────────────────────────────
  it("accepts the center coordinate (12.9716, 77.5946) — AC2.2 interior", () => {
    expect(isInBengaluru(12.9716, 77.5946)).toBe(true);
  });

  // ── Just outside — south ───────────────────────────────────────────────────
  it("rejects lat one unit below latMin — AC2.2 out-of-bounds south", () => {
    // 12.7341 is just below latMin=12.7342
    expect(isInBengaluru(12.7341, 77.5946)).toBe(false);
  });

  // ── Just outside — north ───────────────────────────────────────────────────
  it("rejects lat one unit above latMax — AC2.2 out-of-bounds north", () => {
    // 13.1740 is just above latMax=13.1739
    expect(isInBengaluru(13.174, 77.5946)).toBe(false);
  });

  // ── Just outside — west ────────────────────────────────────────────────────
  it("rejects lng one unit below lngMin — AC2.2 out-of-bounds west", () => {
    expect(isInBengaluru(12.9716, 77.379)).toBe(false);
  });

  // ── Just outside — east ────────────────────────────────────────────────────
  it("rejects lng one unit above lngMax — AC2.2 out-of-bounds east", () => {
    expect(isInBengaluru(12.9716, 77.8732)).toBe(false);
  });

  // ── Wildly outside ─────────────────────────────────────────────────────────
  it("rejects lat=0 lng=0 — AC2.2 coordinates nowhere near Bengaluru", () => {
    expect(isInBengaluru(0, 0)).toBe(false);
  });

  it("rejects Mumbai coordinates — AC2.2 valid coords but wrong city", () => {
    expect(isInBengaluru(19.076, 72.877)).toBe(false);
  });
});
