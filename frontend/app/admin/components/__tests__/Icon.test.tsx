/**
 * Tests for frontend/app/admin/components/Icon.tsx
 *
 * Requirements covered:
 *   ADMIN-UI-02 — Icon component renders without crashing, aria contract correct
 *   ADMIN-UI-07 — Decorative icons carry aria-hidden="true"; interactive contexts
 *                 use aria-label on the parent button
 *
 * Wave 0 stubs — these tests will fail with import errors until Task 2 implements
 * the Icon component. That is the Wave 0 contract.
 */

import React from "react";
import { render } from "@testing-library/react";
import { Icon } from "../Icon";

describe("Icon — aria contract (ADMIN-UI-07)", () => {
  it("renders aria-hidden='true' by default when no aria-label is provided", () => {
    render(<Icon name="menu" />);
    const svg = document.querySelector("svg")!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders role='img' and aria-label when aria-label prop is provided", () => {
    render(<Icon name="menu" aria-label="Open menu" />);
    const svg = document.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Open menu");
  });

  it("renders a fallback SVG (does not throw) for an unknown icon name", () => {
    // @ts-expect-error — intentional unknown name test
    expect(() => render(<Icon name="unknown_icon_xyz_does_not_exist" />)).not.toThrow();
    expect(document.querySelector("svg")).not.toBeNull();
  });
});
