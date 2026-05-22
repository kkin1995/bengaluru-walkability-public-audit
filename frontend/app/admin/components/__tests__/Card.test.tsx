/**
 * Tests for frontend/app/admin/components/Card.tsx
 *
 * Requirements covered:
 *   ADMIN-UI-02 — Card primitive renders without crashing, data-* contract present
 *
 * Wave 0 stubs — these tests will fail with import errors until Task 2 implements
 * the Card component. That is the Wave 0 contract.
 */

import React from "react";
import { render } from "@testing-library/react";
import { Card } from "../Card";

describe("Card — data-* contract (ADMIN-UI-02)", () => {
  it("renders data-padded and data-hoverable attributes reflecting props", () => {
    const { container } = render(<Card padded={true} hoverable={false}>Content</Card>);
    const card = container.querySelector("[data-component='card']")!;
    expect(card).not.toBeNull();
    expect(card.getAttribute("data-padded")).toBe("true");
    expect(card.getAttribute("data-hoverable")).toBe("false");
  });

  it("renders data-padded=false and data-hoverable=true when those props are set", () => {
    const { container } = render(<Card padded={false} hoverable={true}>Content</Card>);
    const card = container.querySelector("[data-component='card']")!;
    expect(card.getAttribute("data-padded")).toBe("false");
    expect(card.getAttribute("data-hoverable")).toBe("true");
  });

  it("renders children inside the card", () => {
    const { container } = render(<Card>Card content here</Card>);
    expect(container.textContent).toContain("Card content here");
  });
});
