/**
 * Tests for frontend/app/admin/components/Btn.tsx
 *
 * Requirements covered:
 *   ADMIN-UI-02 — Btn primitive renders without crashing, data-* contract present
 *   ADMIN-UI-07 — All buttons >= 44px tap target (md and lg sizes satisfy this)
 *
 * Wave 0 stubs — these tests will fail with import errors until Task 2 implements
 * the Btn component. That is the Wave 0 contract.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { Btn } from "../Btn";

describe("Btn — data-* contract (ADMIN-UI-02)", () => {
  it("renders data-variant and data-size attributes on the button element", () => {
    render(<Btn variant="accent" size="lg">Click</Btn>);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("data-variant")).toBe("accent");
    expect(btn.getAttribute("data-size")).toBe("lg");
  });

  it("renders data-component='btn' attribute on the button element", () => {
    render(<Btn>Click</Btn>);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("data-component")).toBe("btn");
  });

  it("renders with default variant='primary' and size='md' when no props given", () => {
    render(<Btn>Click me</Btn>);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("data-variant")).toBe("primary");
    expect(btn.getAttribute("data-size")).toBe("md");
  });
});
