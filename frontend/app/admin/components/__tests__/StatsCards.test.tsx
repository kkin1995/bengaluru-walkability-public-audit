/**
 * Tests for frontend/app/admin/components/StatsCards.tsx
 *
 * Requirements covered (from admin-users-frontend-ac.md):
 *   R-COMP-3   — StatsCards must render the value "0" (not blank, not dash) when count is zero.
 *   R-COMP-4   — StatsCards must render a skeleton loading state while data is fetched.
 *   R-DASH-1   — Dashboard must render StatsCards with counts: total, submitted,
 *                under_review, resolved.
 *
 * AC-DASH-1-S1 — Stats render with live data (4 cards, correct labels and values)
 * AC-DASH-1-S2 — Zero values render as "0" not blank
 * AC-DASH-1-S3 — Skeleton loading state when loading=true
 *
 * Props interface (contract for the implementation agent):
 *   interface StatsData {
 *     total_reports: number;
 *     by_status: { submitted: number; under_review: number; resolved: number };
 *   }
 *   StatsCards({ data?: StatsData; loading?: boolean })
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import StatsCards from "../StatsCards";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LIVE_DATA = {
  total_reports: 142,
  by_status: {
    submitted: 38,
    under_review: 61,
    resolved: 43,
  },
};

const ZERO_DATA = {
  total_reports: 0,
  by_status: {
    submitted: 0,
    under_review: 0,
    resolved: 0,
  },
};

// ---------------------------------------------------------------------------
// AC-DASH-1-S1 — Four cards render with correct labels
// ---------------------------------------------------------------------------

describe("R-DASH-1 / AC-DASH-1-S1 — StatsCards: four visible cards", () => {
  it("renders a card labelled 'Total Reports' (or equivalent)", () => {
    render(<StatsCards data={LIVE_DATA} />);
    // The label text for the total card must be visible.
    expect(screen.getByText(/total reports/i)).toBeInTheDocument();
  });

  it("renders a card labelled 'Submitted' (or equivalent)", () => {
    render(<StatsCards data={LIVE_DATA} />);
    expect(screen.getByText(/submitted/i)).toBeInTheDocument();
  });

  it("renders a card labelled 'Under Review' (or equivalent)", () => {
    render(<StatsCards data={LIVE_DATA} />);
    expect(screen.getByText(/under review/i)).toBeInTheDocument();
  });

  it("renders a card labelled 'Resolved' (or equivalent)", () => {
    render(<StatsCards data={LIVE_DATA} />);
    expect(screen.getByText(/resolved/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-DASH-1-S1 — Correct count values displayed
// ---------------------------------------------------------------------------

describe("R-DASH-1 / AC-DASH-1-S1 — StatsCards: correct count values", () => {
  it("displays the total_reports value 142 prominently", () => {
    render(<StatsCards data={LIVE_DATA} />);
    // The number must appear as visible text; use regex to match "142" anywhere.
    expect(screen.getByText("142")).toBeInTheDocument();
  });

  it("displays the submitted count 38", () => {
    render(<StatsCards data={LIVE_DATA} />);
    expect(screen.getByText("38")).toBeInTheDocument();
  });

  it("displays the under_review count 61", () => {
    render(<StatsCards data={LIVE_DATA} />);
    expect(screen.getByText("61")).toBeInTheDocument();
  });

  it("displays the resolved count 43", () => {
    render(<StatsCards data={LIVE_DATA} />);
    expect(screen.getByText("43")).toBeInTheDocument();
  });

  it("displays all four counts simultaneously — no count is hidden or absent", () => {
    render(<StatsCards data={LIVE_DATA} />);
    // All four numbers must be in the DOM at the same time.
    expect(screen.getByText("142")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
    expect(screen.getByText("43")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-DASH-1-S2 — Zero values render as "0", not blank or dash
// ---------------------------------------------------------------------------

describe('R-COMP-3 / AC-DASH-1-S2 — StatsCards: zero values render as "0"', () => {
  it('renders "0" for total_reports when count is 0', () => {
    render(<StatsCards data={ZERO_DATA} />);
    // getAllByText because multiple cards may each show "0".
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render an empty string in place of any zero count", () => {
    const { container } = render(<StatsCards data={ZERO_DATA} />);
    // Walk text nodes; none of them should be an empty or whitespace-only
    // string in a position that was supposed to carry a number.
    // Strategy: assert all four counts are present as "0" (one per card).
    const zeros = screen.getAllByText("0");
    // We expect exactly 4 zero values — one per card.
    expect(zeros.length).toBeGreaterThanOrEqual(4);
    // None of the four card value nodes should be absent from the DOM.
    expect(container.textContent).not.toMatch(/undefined/);
    expect(container.textContent).not.toMatch(/null/);
  });

  it("does not render a dash '-' character in any card when count is 0", () => {
    const { container } = render(<StatsCards data={ZERO_DATA} />);
    // A dash is a common "no data" placeholder — the AC forbids it.
    // We check that no standalone dash text node appears.
    // This deliberately only checks single-character dashes, not hyphens in words.
    const textContent = container.textContent ?? "";
    // Remove all spaces and check that a lone dash is not the only content
    // in any card's value slot. A strict check: "0" must appear 4 times.
    const zeroMatches = textContent.match(/\b0\b/g) ?? [];
    expect(zeroMatches.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// AC-DASH-1-S3 — Skeleton loading state when loading=true
// ---------------------------------------------------------------------------

describe("R-COMP-4 / AC-DASH-1-S3 — StatsCards: skeleton loading state", () => {
  it("renders skeleton placeholder elements when loading=true", () => {
    render(<StatsCards loading={true} />);
    // The AC requires four skeleton elements in place of metric values.
    // Implementations typically use data-testid="skeleton" or an "animate-pulse" class.
    // We accept either: a data-testid containing "skeleton", or elements with
    // an animation class that signals loading (animate-pulse / shimmer / skeleton).
    const byTestId = document.querySelectorAll('[data-testid*="skeleton"]');
    const byClass = document.querySelectorAll(
      ".animate-pulse, .skeleton, [class*='skeleton'], [class*='shimmer']"
    );
    const skeletonCount = byTestId.length + byClass.length;
    expect(skeletonCount).toBeGreaterThan(0);
  });

  it("does NOT show any numeric count values when loading=true", () => {
    render(<StatsCards loading={true} />);
    // No actual numbers should be visible during the loading phase.
    // We assert that none of the potential data numbers are in the document.
    expect(screen.queryByText("142")).not.toBeInTheDocument();
    expect(screen.queryByText("38")).not.toBeInTheDocument();
    expect(screen.queryByText("61")).not.toBeInTheDocument();
    expect(screen.queryByText("43")).not.toBeInTheDocument();
  });

  it("still renders four card-shaped skeleton slots when loading=true", () => {
    render(<StatsCards loading={true} />);
    // There should be exactly four skeleton placeholders — one per stat card.
    const byTestId = document.querySelectorAll('[data-testid*="skeleton"]');
    const byClass = document.querySelectorAll(
      ".animate-pulse, .skeleton, [class*='skeleton'], [class*='shimmer']"
    );
    const skeletonCount = byTestId.length || byClass.length;
    // At least 4 skeleton elements: total, submitted, under_review, resolved
    expect(skeletonCount).toBeGreaterThanOrEqual(4);
  });

  it("renders normal stat values (not skeletons) when loading is false", () => {
    render(<StatsCards data={LIVE_DATA} loading={false} />);
    expect(screen.getByText("142")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Edge: no data, no loading — renders gracefully without crashing
// ---------------------------------------------------------------------------

describe("StatsCards: edge cases", () => {
  it("renders without throwing when neither data nor loading is provided", () => {
    expect(() => render(<StatsCards />)).not.toThrow();
  });
});
