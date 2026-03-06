/**
 * Tests for frontend/app/admin/components/StatusBadge.tsx
 *
 * Requirements covered (from admin-users-frontend-ac.md):
 *   R-COMP-6  — StatusBadge must render: gray for submitted, amber for under_review,
 *               green for resolved, and must carry an aria-label that includes the
 *               human-readable status text.
 *
 * AC-COMP-6-S1 — Color mapping and accessibility
 * AC-COMP-6-F1 — Unknown status value falls back to gray
 *
 * Interpretation notes:
 *   - "gray background class"  → Tailwind class containing "gray"   (e.g. bg-gray-100)
 *   - "amber background class" → Tailwind class containing "amber"  (e.g. bg-amber-100)
 *   - "green background class" → Tailwind class containing "green"  (e.g. bg-green-100)
 *   - aria-label must contain the human-readable text (not the raw snake_case value).
 *     "under_review" → aria-label contains "under review" (space, not underscore).
 *   - For unknown statuses the aria-label must contain the raw value passed in.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import StatusBadge from "../StatusBadge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns all Tailwind class tokens on the element that contain the given
 * substring. Used to assert colour presence without hard-coding the exact
 * Tailwind class name (e.g., bg-gray-100 vs bg-gray-200).
 */
function classesContaining(el: HTMLElement, fragment: string): string[] {
  return el.className.split(/\s+/).filter((c) => c.includes(fragment));
}

// ---------------------------------------------------------------------------
// AC-COMP-6-S1 — "submitted" → gray + aria-label
// ---------------------------------------------------------------------------

describe('R-COMP-6 / AC-COMP-6-S1 — StatusBadge: status="submitted"', () => {
  it('renders with a gray background class when status is "submitted"', () => {
    render(<StatusBadge status="submitted" />);
    // The badge element is the first element that carries the colour styling.
    // We query by role first (generic element); if no role the container div is used.
    const badge = screen.getByRole("status", { hidden: true }) ??
      document.querySelector('[aria-label]') as HTMLElement;
    // Fallback: find the element that has an aria-label set by the component.
    const el = document.querySelector("[aria-label]") as HTMLElement;
    expect(el).not.toBeNull();
    expect(classesContaining(el, "gray").length).toBeGreaterThan(0);
  });

  it('aria-label contains "submitted" when status is "submitted"', () => {
    render(<StatusBadge status="submitted" />);
    const el = document.querySelector("[aria-label]") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.getAttribute("aria-label")!.toLowerCase()).toContain("submitted");
  });

  it('"submitted" badge does NOT use amber or green background classes', () => {
    render(<StatusBadge status="submitted" />);
    const el = document.querySelector("[aria-label]") as HTMLElement;
    expect(classesContaining(el, "amber")).toHaveLength(0);
    expect(classesContaining(el, "green")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-COMP-6-S1 — "under_review" → amber + aria-label
// ---------------------------------------------------------------------------

describe('R-COMP-6 / AC-COMP-6-S1 — StatusBadge: status="under_review"', () => {
  it('renders with an amber background class when status is "under_review"', () => {
    render(<StatusBadge status="under_review" />);
    const el = document.querySelector("[aria-label]") as HTMLElement;
    expect(el).not.toBeNull();
    expect(classesContaining(el, "amber").length).toBeGreaterThan(0);
  });

  it(
    'aria-label contains "under review" (human-readable, not "under_review") ' +
      'when status is "under_review"',
    () => {
      render(<StatusBadge status="under_review" />);
      const el = document.querySelector("[aria-label]") as HTMLElement;
      expect(el).not.toBeNull();
      // The AC states the aria-label must include the human-readable string "under review"
      // with a space, not the raw snake_case value with an underscore.
      expect(el.getAttribute("aria-label")!.toLowerCase()).toContain(
        "under review"
      );
    }
  );

  it('"under_review" badge does NOT use gray or green background classes', () => {
    render(<StatusBadge status="under_review" />);
    const el = document.querySelector("[aria-label]") as HTMLElement;
    expect(classesContaining(el, "green")).toHaveLength(0);
    // gray is reserved for submitted; amber variant may include yellow-adjacent shades
    expect(classesContaining(el, "gray")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-COMP-6-S1 — "resolved" → green + aria-label
// ---------------------------------------------------------------------------

describe('R-COMP-6 / AC-COMP-6-S1 — StatusBadge: status="resolved"', () => {
  it('renders with a green background class when status is "resolved"', () => {
    render(<StatusBadge status="resolved" />);
    const el = document.querySelector("[aria-label]") as HTMLElement;
    expect(el).not.toBeNull();
    expect(classesContaining(el, "green").length).toBeGreaterThan(0);
  });

  it('aria-label contains "resolved" when status is "resolved"', () => {
    render(<StatusBadge status="resolved" />);
    const el = document.querySelector("[aria-label]") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.getAttribute("aria-label")!.toLowerCase()).toContain("resolved");
  });

  it('"resolved" badge does NOT use gray or amber background classes', () => {
    render(<StatusBadge status="resolved" />);
    const el = document.querySelector("[aria-label]") as HTMLElement;
    expect(classesContaining(el, "gray")).toHaveLength(0);
    expect(classesContaining(el, "amber")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-COMP-6-S1 — each status renders visible text (human-readable label)
// ---------------------------------------------------------------------------

describe("R-COMP-6 — StatusBadge: visible human-readable text", () => {
  it.each([
    { status: "submitted", expectedText: /submitted/i },
    { status: "under_review", expectedText: /under review/i },
    { status: "resolved", expectedText: /resolved/i },
  ])(
    'status "$status" renders human-readable visible text "$expectedText"',
    ({ status, expectedText }) => {
      render(<StatusBadge status={status} />);
      // The badge must display readable text — not just carry an aria-label in the void.
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    }
  );
});

// ---------------------------------------------------------------------------
// AC-COMP-6-F1 — unknown status → gray fallback, no thrown error
// ---------------------------------------------------------------------------

describe("R-COMP-6 / AC-COMP-6-F1 — StatusBadge: unknown status value", () => {
  it('renders without throwing when an unknown status "archived" is supplied', () => {
    expect(() => render(<StatusBadge status="archived" />)).not.toThrow();
  });

  it('falls back to a gray background class for unknown status "archived"', () => {
    render(<StatusBadge status="archived" />);
    const el = document.querySelector("[aria-label]") as HTMLElement;
    expect(el).not.toBeNull();
    expect(classesContaining(el, "gray").length).toBeGreaterThan(0);
  });

  it('aria-label contains the raw unknown status value "archived"', () => {
    render(<StatusBadge status="archived" />);
    const el = document.querySelector("[aria-label]") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.getAttribute("aria-label")!.toLowerCase()).toContain("archived");
  });

  it('renders without throwing when status is an empty string ""', () => {
    expect(() => render(<StatusBadge status="" />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Accessibility — every known status produces exactly one element with aria-label
// ---------------------------------------------------------------------------

describe("R-COMP-6 — StatusBadge: aria-label presence for all known statuses", () => {
  it.each(["submitted", "under_review", "resolved"])(
    'status "%s" produces at least one element carrying an aria-label attribute',
    (status) => {
      render(<StatusBadge status={status} />);
      const elements = document.querySelectorAll("[aria-label]");
      expect(elements.length).toBeGreaterThan(0);
    }
  );
});
