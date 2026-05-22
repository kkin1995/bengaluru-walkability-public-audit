/**
 * Tests for frontend/app/admin/components/Pill.tsx
 *
 * Requirements covered:
 *   ADMIN-UI-02 — Pill primitive renders without crashing, data-* contract present
 *
 * Wave 0 stubs — these tests will fail with import errors until Task 2 implements
 * the Pill component. That is the Wave 0 contract.
 */

import React from "react";
import { render } from "@testing-library/react";
import { Pill } from "../Pill";

describe("Pill — data-* contract (ADMIN-UI-02)", () => {
  it("renders data-tone and data-size attributes", () => {
    const { container } = render(<Pill tone="warn" size="sm">Label</Pill>);
    const pill = container.querySelector("[data-component='pill']")!;
    expect(pill).not.toBeNull();
    expect(pill.getAttribute("data-tone")).toBe("warn");
    expect(pill.getAttribute("data-size")).toBe("sm");
  });

  it("renders data-component='pill' on the root element", () => {
    const { container } = render(<Pill>Label</Pill>);
    const pill = container.querySelector("[data-component='pill']");
    expect(pill).not.toBeNull();
  });

  it("renders children text inside the pill", () => {
    const { container } = render(<Pill tone="accent">Teal Pill</Pill>);
    expect(container.textContent).toContain("Teal Pill");
  });
});
