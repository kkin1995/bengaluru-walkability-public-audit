/**
 * Tests for frontend/app/components/CategoryPicker.tsx
 *
 * Requirements covered:
 *   R3 — Category Selection
 *   AC3.1 — No category selected → Next disabled (tested via onChange not called)
 *   AC3.2 — Selected category has green border + background; others default
 *   AC3.3 — All 6 categories show correct emoji, label, description
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CategoryPicker from "../CategoryPicker";

// ─────────────────────────────────────────────────────────────────────────────
// Test data — mirrors the CATEGORIES array in CategoryPicker.tsx exactly
// ─────────────────────────────────────────────────────────────────────────────
const EXPECTED_CATEGORIES = [
  {
    value: "no_footpath",
    emoji: "🚶",
    label: "No Footpath",
    description: "No path — walking on the road",
  },
  {
    value: "broken_footpath",
    emoji: "🕳️",
    label: "Damaged Footpath",
    description: "Cracked tiles, open drain, dug-up surface",
  },
  {
    value: "blocked_footpath",
    emoji: "🚧",
    label: "Blocked Footpath",
    description: "Bikes, vendors, or debris blocking the path",
  },
  {
    value: "unsafe_crossing",
    emoji: "⚠️",
    label: "Unsafe Crossing",
    description: "No signal, faded zebra, or no crossing at all",
  },
  {
    value: "poor_lighting",
    emoji: "🌑",
    label: "Poor Lighting",
    description: "Street lights out or missing in this area",
  },
  {
    value: "other",
    emoji: "📍",
    label: "Other Issue",
    description: "Doesn't fit above — describe in details",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// R3 / AC3.3 — Rendering all 6 categories
// ─────────────────────────────────────────────────────────────────────────────
describe("R3 — CategoryPicker: rendering", () => {
  it("renders exactly 6 category buttons — AC3.3", () => {
    render(<CategoryPicker value="" onChange={jest.fn()} />);
    // Each category is a <button> element
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(
      6
    );
  });

  it.each(EXPECTED_CATEGORIES)(
    "renders emoji '$emoji', label '$label', description for $value — AC3.3",
    ({ emoji, label, description }) => {
      render(<CategoryPicker value="" onChange={jest.fn()} />);
      expect(
        screen.getByText(emoji)
      ).toBeInTheDocument();
      expect(
        screen.getByText(label)
      ).toBeInTheDocument();
      expect(
        screen.getByText(description)
      ).toBeInTheDocument();
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// R3 / AC3.2 — Selection styling
// ─────────────────────────────────────────────────────────────────────────────
describe("R3 / AC3.2 — CategoryPicker: selection styling", () => {
  it("selected category button includes border-green-600 and bg-green-50 classes", () => {
    render(<CategoryPicker value="no_footpath" onChange={jest.fn()} />);
    // The button that contains the label "No Footpath" is the selected one
    const selectedButton = screen.getByText("No Footpath").closest("button");
    expect(selectedButton).toHaveClass("border-green-600");
    expect(selectedButton).toHaveClass("bg-green-50");
  });

  it("unselected category buttons do NOT include border-green-600 — AC3.2", () => {
    render(<CategoryPicker value="no_footpath" onChange={jest.fn()} />);
    // All categories except no_footpath should not have green border
    const otherLabels = EXPECTED_CATEGORIES.filter(
      (c) => c.value !== "no_footpath"
    ).map((c) => c.label);

    for (const label of otherLabels) {
      const btn = screen.getByText(label).closest("button");
      expect(btn).not.toHaveClass("border-green-600");
      expect(btn).not.toHaveClass("bg-green-50");
    }
  });

  it("when value is empty string, no button has the selected green classes — AC3.1", () => {
    render(<CategoryPicker value="" onChange={jest.fn()} />);
    const allButtons = screen.getAllByRole("button");
    for (const btn of allButtons) {
      expect(btn).not.toHaveClass("border-green-600");
    }
  });

  it("switches the green highlight when value changes to a different category", () => {
    const { rerender } = render(
      <CategoryPicker value="no_footpath" onChange={jest.fn()} />
    );
    rerender(<CategoryPicker value="poor_lighting" onChange={jest.fn()} />);

    const nowSelected = screen.getByText("Poor Lighting").closest("button");
    const nowDeselected = screen.getByText("No Footpath").closest("button");

    expect(nowSelected).toHaveClass("border-green-600");
    expect(nowDeselected).not.toHaveClass("border-green-600");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R3 / AC3.1 — onChange interaction
// ─────────────────────────────────────────────────────────────────────────────
describe("R3 / AC3.1 — CategoryPicker: onChange callback", () => {
  it("calls onChange with the correct value when a category button is clicked", async () => {
    const handleChange = jest.fn();
    render(<CategoryPicker value="" onChange={handleChange} />);

    await userEvent.click(screen.getByText("Damaged Footpath").closest("button")!);

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith("broken_footpath");
  });

  it.each(EXPECTED_CATEGORIES)(
    "clicking '$label' calls onChange with '$value' — AC3.1",
    async ({ label, value }) => {
      const handleChange = jest.fn();
      render(<CategoryPicker value="" onChange={handleChange} />);

      await userEvent.click(screen.getByText(label).closest("button")!);

      expect(handleChange).toHaveBeenCalledWith(value);
    }
  );

  it("does NOT call onChange until a category is clicked — AC3.1 (no default selection)", () => {
    const handleChange = jest.fn();
    render(<CategoryPicker value="" onChange={handleChange} />);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
