/**
 * Tests for frontend/app/admin/components/SeverityIndicator.tsx
 *
 * Requirements covered:
 *   ADMIN-UI-02 — SeverityIndicator renders without crashing
 *   ADMIN-UI-07 — Triple-encoding: bars (aria-hidden) + text label + color.
 *                 Never color-only (WCAG 1.4.1 non-text contrast).
 *
 * Wave 0 stubs — these tests will fail with import errors until Task 2 implements
 * the SeverityIndicator component. That is the Wave 0 contract.
 */

import React from "react";
import { render } from "@testing-library/react";
import { SeverityIndicator } from "../SeverityIndicator";

describe("SeverityIndicator — bars triple-encoding (ADMIN-UI-07)", () => {
  it("renders exactly three bar spans inside the aria-hidden bars wrapper", () => {
    const { container } = render(<SeverityIndicator severity="high" />);
    // The bars wrapper has aria-hidden="true"; it contains 3 child spans (bar heights [4,8,12])
    const barsWrapper = container.querySelector("[aria-hidden='true']");
    expect(barsWrapper).not.toBeNull();
    const bars = barsWrapper!.querySelectorAll("span");
    expect(bars.length).toBe(3);
  });

  it("renders the text label 'Low' for severity='low'", () => {
    const { container } = render(<SeverityIndicator severity="low" />);
    expect(container.textContent).toContain("Low");
  });

  it("renders the text label 'Medium' for severity='medium'", () => {
    const { container } = render(<SeverityIndicator severity="medium" />);
    expect(container.textContent).toContain("Medium");
  });

  it("renders the text label 'High' for severity='high'", () => {
    const { container } = render(<SeverityIndicator severity="high" />);
    expect(container.textContent).toContain("High");
  });
});
