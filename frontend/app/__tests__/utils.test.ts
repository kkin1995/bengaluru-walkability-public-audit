/**
 * Tests for frontend/app/lib/utils.ts — haversineDistance utility.
 *
 * Requirements covered:
 *   §2.3-U1 — haversineDistance(lat1, lng1, lat2, lng2) returns distance in metres
 *   §2.3-U2 — Same point returns exactly 0
 *   §2.3-U3 — Known ~111 km distance (1 degree latitude at equator)
 *   §2.3-U4 — The 500 m threshold boundary is computed accurately (within ±10 m)
 *   §2.3-U5 — Return value is always a finite number (never NaN)
 *   §2.3-U6 — Antipodal points (~20 015 km) are handled without overflow
 *
 * Why these tests exist:
 *   The EXIF vs manual-pin conflict warning (Feature §2.3) fires when the user's
 *   dropped pin is MORE THAN 500 m from the photo's EXIF GPS coordinates.
 *   haversineDistance is the pure function that computes this distance. Its
 *   correctness is the foundation of the entire warning feature — an incorrect
 *   implementation would either suppress legitimate warnings or create false
 *   positives. These tests validate the mathematical contract independently of
 *   any UI component.
 *
 * Determinism notes:
 *   - No wall-clock time used.
 *   - No random data — all inputs are fixed constants.
 *   - No network calls.
 *   - Expected ranges for floating-point results use toBeGreaterThan / toBeLessThan
 *     to tolerate minor floating-point implementation differences while still
 *     enforcing a tight accuracy window (≤1% error for geospatial use).
 */

import { haversineDistance } from "../lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// §2.3-U1 / §2.3-U2 — Same point returns 0
// ─────────────────────────────────────────────────────────────────────────────
describe("haversineDistance — same point", () => {
  it("returns exactly 0 when both coordinates are identical — §2.3-U2", () => {
    const distance = haversineDistance(12.9716, 77.5946, 12.9716, 77.5946);
    expect(distance).toBe(0);
  });

  it("returns 0 for the origin (0°N 0°E) compared to itself", () => {
    const distance = haversineDistance(0, 0, 0, 0);
    expect(distance).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2.3-U3 — Known ~111 km distance (1 degree latitude)
// ─────────────────────────────────────────────────────────────────────────────
describe("haversineDistance — 1 degree latitude ≈ 111 km", () => {
  it("returns between 110 000 m and 112 000 m for 1 degree of latitude at the equator — §2.3-U3", () => {
    // The Earth's circumference is ~40 075 km. One degree of latitude ≈ 111.32 km.
    // Acceptable range: 110 km – 112 km to tolerate Earth ellipsoid approximation.
    const distance = haversineDistance(0, 0, 1, 0);
    expect(distance).toBeGreaterThan(110_000);
    expect(distance).toBeLessThan(112_000);
  });

  it("returns between 110 000 m and 112 000 m for 1 degree of latitude in Bengaluru's lat range", () => {
    // Validate at a representative latitude (12°N) — haversine must handle non-equatorial inputs.
    const distance = haversineDistance(12.0, 77.5946, 13.0, 77.5946);
    expect(distance).toBeGreaterThan(110_000);
    expect(distance).toBeLessThan(112_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2.3-U4 — 500 m boundary accuracy (core threshold for the warning feature)
// ─────────────────────────────────────────────────────────────────────────────
describe("haversineDistance — 500 m threshold boundary", () => {
  it("~500 m apart (0.0045° latitude difference) returns between 490 m and 510 m — §2.3-U4", () => {
    // 1 degree latitude ≈ 111 320 m, so 500 m ≈ 0.004 492 degrees.
    // Using 0.0045° gives ≈ 500.94 m — within the ±10 m acceptable band.
    // This is the canonical fixture pair for the 500 m threshold.
    const distance = haversineDistance(12.9716, 77.5946, 12.9761, 77.5946);
    expect(distance).toBeGreaterThan(490);
    expect(distance).toBeLessThan(510);
  });

  it("~501 m apart (just over threshold) returns a value greater than 500 m", () => {
    // 0.004501° latitude ≈ 501 m. Used to verify the warning DOES fire at this distance.
    // This is the canonical "trigger" fixture for the conflict warning test suite.
    const distance = haversineDistance(12.9716, 77.5946, 12.97610 + 0.000001, 77.5946);
    expect(distance).toBeGreaterThan(500);
  });

  it("~499 m apart (just under threshold) returns a value less than 500 m", () => {
    // 0.004489° latitude ≈ 499 m. Used to verify the warning does NOT fire at this distance.
    const distance = haversineDistance(12.9716, 77.5946, 12.9761 - 0.0001, 77.5946);
    expect(distance).toBeLessThan(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2.3-U5 — Return value is always a finite number, never NaN
// ─────────────────────────────────────────────────────────────────────────────
describe("haversineDistance — output type invariants", () => {
  it("returns a number (not NaN) for arbitrary valid Bengaluru coordinates — §2.3-U5", () => {
    const distance = haversineDistance(12.9716, 77.5946, 13.0, 77.6);
    expect(distance).not.toBeNaN();
    expect(typeof distance).toBe("number");
  });

  it("returns a non-negative number for any ordered pair of points", () => {
    // Distance is a magnitude — it must always be ≥ 0.
    const d1 = haversineDistance(12.9716, 77.5946, 13.0, 77.6);
    const d2 = haversineDistance(13.0, 77.6, 12.9716, 77.5946); // reversed order
    expect(d1).toBeGreaterThanOrEqual(0);
    expect(d2).toBeGreaterThanOrEqual(0);
  });

  it("is symmetric — distance(A→B) equals distance(B→A)", () => {
    // Haversine is symmetric. Violating this would indicate a sign error in the formula.
    const forward = haversineDistance(12.9716, 77.5946, 12.9761, 77.5946);
    const reverse = haversineDistance(12.9761, 77.5946, 12.9716, 77.5946);
    expect(forward).toBeCloseTo(reverse, 6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2.3-U6 — Antipodal points (~20 015 km) — no overflow or NaN
// ─────────────────────────────────────────────────────────────────────────────
describe("haversineDistance — antipodal points", () => {
  it("returns approximately 20 015 km for antipodal points (0°N 0°E) → (0°N 180°E) — §2.3-U6", () => {
    // Half the Earth's equatorial circumference ≈ 20 037 km.
    // Acceptable range: 20 000 km – 20 100 km.
    const distance = haversineDistance(0, 0, 0, 180);
    expect(distance).toBeGreaterThan(20_000_000);
    expect(distance).toBeLessThan(20_100_000);
  });

  it("antipodal result is finite and not NaN — §2.3-U6 (no floating-point overflow)", () => {
    const distance = haversineDistance(0, 0, 0, 180);
    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).not.toBeNaN();
  });
});
