/**
 * Tests for frontend/app/admin/components/StatusBadge.tsx
 *
 * Requirements covered (from admin-users-frontend-ac.md):
 *   R-COMP-6  — StatusBadge must render with tone mapping: info for submitted,
 *               warn for under_review, accent for resolved, and must carry an
 *               aria-label that includes the human-readable status text.
 *
 * AC-COMP-6-S1 — data-tone attribute mapping and accessibility
 * AC-COMP-6-F1 — Unknown status value falls back to submitted (info) tone
 *
 * Migration note (Phase 02.5):
 *   Assertions migrated from Tailwind classesContaining() to data-tone getAttribute().
 *   The rewritten StatusBadge uses CSS custom properties via inline style — no Tailwind
 *   class names are present. data-tone is the testable signal for tone/color mapping.
 *
 *   Tone mapping:
 *     submitted    → data-tone="info"
 *     under_review → data-tone="warn"
 *     resolved     → data-tone="accent"
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import StatusBadge from "../StatusBadge";

// ---------------------------------------------------------------------------
// AC-COMP-6-S1 — "submitted" → info tone + aria-label
// ---------------------------------------------------------------------------

describe('R-COMP-6 / AC-COMP-6-S1 — StatusBadge: status="submitted"', () => {
  it('renders with data-tone="info" when status is "submitted"', () => {
    render(<StatusBadge status="submitted" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.getAttribute("data-tone")).toBe("info");
  });

  it('aria-label contains "submitted" when status is "submitted"', () => {
    render(<StatusBadge status="submitted" />);
    const el = document.querySelector("[aria-label]") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.getAttribute("aria-label")!.toLowerCase()).toContain("submitted");
  });

  it('"submitted" badge does NOT have data-tone of "warn" or "accent"', () => {
    render(<StatusBadge status="submitted" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge.getAttribute("data-tone")).not.toBe("warn");
    expect(badge.getAttribute("data-tone")).not.toBe("accent");
  });
});

// ---------------------------------------------------------------------------
// AC-COMP-6-S1 — "under_review" → warn tone + aria-label
// ---------------------------------------------------------------------------

describe('R-COMP-6 / AC-COMP-6-S1 — StatusBadge: status="under_review"', () => {
  it('renders with data-tone="warn" when status is "under_review"', () => {
    render(<StatusBadge status="under_review" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.getAttribute("data-tone")).toBe("warn");
  });

  it(
    'aria-label contains "under review" (human-readable, not "under_review") ' +
      'when status is "under_review"',
    () => {
      render(<StatusBadge status="under_review" />);
      const el = document.querySelector("[aria-label]") as HTMLElement;
      expect(el).not.toBeNull();
      expect(el.getAttribute("aria-label")!.toLowerCase()).toContain(
        "under review"
      );
    }
  );

  it('"under_review" badge does NOT have data-tone of "info" or "accent"', () => {
    render(<StatusBadge status="under_review" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge.getAttribute("data-tone")).not.toBe("info");
    expect(badge.getAttribute("data-tone")).not.toBe("accent");
  });
});

// ---------------------------------------------------------------------------
// AC-COMP-6-S1 — "resolved" → accent tone + aria-label
// ---------------------------------------------------------------------------

describe('R-COMP-6 / AC-COMP-6-S1 — StatusBadge: status="resolved"', () => {
  it('renders with data-tone="accent" when status is "resolved"', () => {
    render(<StatusBadge status="resolved" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.getAttribute("data-tone")).toBe("accent");
  });

  it('aria-label contains "resolved" when status is "resolved"', () => {
    render(<StatusBadge status="resolved" />);
    const el = document.querySelector("[aria-label]") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.getAttribute("aria-label")!.toLowerCase()).toContain("resolved");
  });

  it('"resolved" badge does NOT have data-tone of "info" or "warn"', () => {
    render(<StatusBadge status="resolved" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge.getAttribute("data-tone")).not.toBe("info");
    expect(badge.getAttribute("data-tone")).not.toBe("warn");
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
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    }
  );
});

// ---------------------------------------------------------------------------
// AC-COMP-6-F1 — unknown status → fallback (info tone), no thrown error
// ---------------------------------------------------------------------------

describe("R-COMP-6 / AC-COMP-6-F1 — StatusBadge: unknown status value", () => {
  it('renders without throwing when an unknown status "archived" is supplied', () => {
    expect(() => render(<StatusBadge status="archived" />)).not.toThrow();
  });

  it('falls back to data-tone="info" for unknown status "archived"', () => {
    render(<StatusBadge status="archived" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.getAttribute("data-tone")).toBe("info");
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

// ---------------------------------------------------------------------------
// data-testid presence — StatusBadge always carries testable identity
// ---------------------------------------------------------------------------

describe("R-COMP-6 — StatusBadge: data-testid='status-badge' always present", () => {
  it.each(["submitted", "under_review", "resolved", "archived"])(
    'status "%s" renders with data-testid="status-badge"',
    (status) => {
      render(<StatusBadge status={status} />);
      const badge = document.querySelector("[data-testid='status-badge']");
      expect(badge).not.toBeNull();
    }
  );
});

// ---------------------------------------------------------------------------
// Phase 03 (D-03..D-05) — 6-value status lifecycle: Wave 0 scaffold tests
// Ref: 03-UI-SPEC.md §"Status Color System — 6-State Admin StatusBadge"
// These tests verify the Phase 03 StatusBadge entries land with the correct
// data-status attribute, human-readable label, and data-tone value.
// ---------------------------------------------------------------------------

describe('Phase 03 / D-03 — StatusBadge: status="open"', () => {
  it('renders with data-status="open"', () => {
    render(<StatusBadge status="open" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.getAttribute("data-status")).toBe("open");
  });

  it('renders the human-readable label "Open"', () => {
    render(<StatusBadge status="open" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("Open");
  });

  it('renders with data-tone="info"', () => {
    render(<StatusBadge status="open" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge.getAttribute("data-tone")).toBe("info");
  });
});

describe('Phase 03 / D-04 — StatusBadge: status="acknowledged"', () => {
  it('renders with data-status="acknowledged"', () => {
    render(<StatusBadge status="acknowledged" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.getAttribute("data-status")).toBe("acknowledged");
  });

  it('renders the human-readable label "Acknowledged"', () => {
    render(<StatusBadge status="acknowledged" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("Acknowledged");
  });

  it('renders with data-tone="info"', () => {
    render(<StatusBadge status="acknowledged" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge.getAttribute("data-tone")).toBe("info");
  });
});

describe('Phase 03 / D-05 — StatusBadge: status="assigned"', () => {
  it('renders with data-status="assigned"', () => {
    render(<StatusBadge status="assigned" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.getAttribute("data-status")).toBe("assigned");
  });

  it('renders the human-readable label "Assigned"', () => {
    render(<StatusBadge status="assigned" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("Assigned");
  });

  it('renders with data-tone="warn"', () => {
    render(<StatusBadge status="assigned" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge.getAttribute("data-tone")).toBe("warn");
  });
});

describe('Phase 03 / D-05 — StatusBadge: status="in_progress"', () => {
  it('renders with data-status="in_progress"', () => {
    render(<StatusBadge status="in_progress" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.getAttribute("data-status")).toBe("in_progress");
  });

  it('renders the human-readable label "In Progress"', () => {
    render(<StatusBadge status="in_progress" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("In Progress");
  });

  it('renders with data-tone="warn"', () => {
    render(<StatusBadge status="in_progress" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge.getAttribute("data-tone")).toBe("warn");
  });
});

describe('Phase 03 / D-37 — StatusBadge: status="closed"', () => {
  it('renders with data-status="closed"', () => {
    render(<StatusBadge status="closed" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.getAttribute("data-status")).toBe("closed");
  });

  it('renders the human-readable label "Closed"', () => {
    render(<StatusBadge status="closed" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("Closed");
  });

  it('renders with data-tone="muted" (distinct grey tone — D-37/D-38)', () => {
    render(<StatusBadge status="closed" />);
    const badge = document.querySelector("[data-testid='status-badge']") as HTMLElement;
    expect(badge.getAttribute("data-tone")).toBe("muted");
  });
});

describe("Phase 03 — StatusBadge: aria-label presence for all 6 Phase 03 statuses", () => {
  it.each(["open", "acknowledged", "assigned", "in_progress", "resolved", "closed"])(
    'status "%s" produces at least one element carrying an aria-label attribute',
    (status) => {
      render(<StatusBadge status={status} />);
      const elements = document.querySelectorAll("[aria-label]");
      expect(elements.length).toBeGreaterThan(0);
    }
  );
});
