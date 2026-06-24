/**
 * Tests for publicStatusMatches() in frontend/app/lib/translations.ts
 *
 * Requirements covered:
 *   TRIAGE-03 — public /map status filter must be consistent between
 *               chip counts (statusCounts in map/page.tsx) and render
 *               filter (ReportsMap.tsx marker .filter()).
 *
 * Regression guards (marked below) directly encode the discovered defect:
 *   acknowledged/assigned must NOT match the "in_progress" bucket.
 */

import { publicStatusMatches } from "../translations";

describe("publicStatusMatches — Open bucket", () => {
  it("open status matches the open bucket", () => {
    expect(publicStatusMatches("open", "open")).toBe(true);
  });

  it("acknowledged status matches the open bucket", () => {
    expect(publicStatusMatches("acknowledged", "open")).toBe(true);
  });

  it("assigned status matches the open bucket", () => {
    expect(publicStatusMatches("assigned", "open")).toBe(true);
  });

  it("in_progress status does NOT match the open bucket", () => {
    expect(publicStatusMatches("in_progress", "open")).toBe(false);
  });
});

describe("publicStatusMatches — In progress bucket", () => {
  it("in_progress status matches the in_progress bucket", () => {
    expect(publicStatusMatches("in_progress", "in_progress")).toBe(true);
  });

  // REGRESSION GUARD (TRIAGE-03): acknowledged must NOT appear under "In progress"
  it("acknowledged status does NOT match in_progress bucket [REGRESSION GUARD]", () => {
    expect(publicStatusMatches("acknowledged", "in_progress")).toBe(false);
  });

  // REGRESSION GUARD (TRIAGE-03): assigned must NOT appear under "In progress"
  it("assigned status does NOT match in_progress bucket [REGRESSION GUARD]", () => {
    expect(publicStatusMatches("assigned", "in_progress")).toBe(false);
  });
});

describe("publicStatusMatches — Resolved bucket", () => {
  it("resolved status matches the resolved bucket", () => {
    expect(publicStatusMatches("resolved", "resolved")).toBe(true);
  });

  it("closed status matches the resolved bucket", () => {
    expect(publicStatusMatches("closed", "resolved")).toBe(true);
  });

  it("open status does NOT match the resolved bucket", () => {
    expect(publicStatusMatches("open", "resolved")).toBe(false);
  });
});

describe("publicStatusMatches — All bucket", () => {
  it("open status matches the all bucket", () => {
    expect(publicStatusMatches("open", "all")).toBe(true);
  });

  it("in_progress status matches the all bucket", () => {
    expect(publicStatusMatches("in_progress", "all")).toBe(true);
  });

  it("resolved status matches the all bucket", () => {
    expect(publicStatusMatches("resolved", "all")).toBe(true);
  });

  it("an unknown status matches the all bucket", () => {
    expect(publicStatusMatches("anything", "all")).toBe(true);
  });
});
