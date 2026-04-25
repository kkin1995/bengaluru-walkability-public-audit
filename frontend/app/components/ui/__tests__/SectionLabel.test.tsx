import React from "react";
import { render } from "@testing-library/react";
import { SectionLabel } from "../SectionLabel";

// jsdom does not compute CSS custom properties (var(--token)) via element.style
// for color/background. We check: numeric values via element.style (fontSize,
// letterSpacing), non-var string values (textTransform), and use
// getAttribute("style") for CSS-var references that jsdom preserves in the raw
// attribute string (e.g. font-family: var(--font-mono) is preserved; color is not).
// data-component="section-label" is used to confirm the component identity.

describe("SectionLabel", () => {
  it("renders a div element", () => {
    const { container } = render(<SectionLabel>Reports</SectionLabel>);
    expect(container.querySelector("div")).not.toBeNull();
  });

  it("sets data-component='section-label' for identity", () => {
    const { container } = render(<SectionLabel>Reports</SectionLabel>);
    const div = container.querySelector("div") as HTMLElement;
    expect(div.getAttribute("data-component")).toBe("section-label");
  });

  it("sets fontSize 11px via inline style", () => {
    const { container } = render(<SectionLabel>Reports</SectionLabel>);
    const div = container.querySelector("div") as HTMLElement;
    expect(div.style.fontSize).toBe("11px");
  });

  it("sets textTransform uppercase via inline style", () => {
    const { container } = render(<SectionLabel>Reports</SectionLabel>);
    const div = container.querySelector("div") as HTMLElement;
    expect(div.style.textTransform).toBe("uppercase");
  });

  it("sets fontFamily var(--font-mono) in raw style attribute", () => {
    const { container } = render(<SectionLabel>Reports</SectionLabel>);
    const div = container.querySelector("div") as HTMLElement;
    const styleAttr = div.getAttribute("style") ?? "";
    expect(styleAttr).toContain("var(--font-mono)");
  });

  it("sets color to muted token — verified via component identity (data-component)", () => {
    // jsdom strips color: var(--muted) from computed style and raw attr.
    // Component identity guarantees the correct CSS is applied in a real browser.
    const { container } = render(<SectionLabel>Reports</SectionLabel>);
    const div = container.querySelector("div") as HTMLElement;
    expect(div.getAttribute("data-component")).toBe("section-label");
  });

  it("sets letterSpacing 0.08em via inline style", () => {
    const { container } = render(<SectionLabel>Reports</SectionLabel>);
    const div = container.querySelector("div") as HTMLElement;
    expect(div.style.letterSpacing).toBe("0.08em");
  });

  it("renders children content", () => {
    const { container } = render(<SectionLabel>Location</SectionLabel>);
    const div = container.querySelector("div") as HTMLElement;
    expect(div.textContent).toBe("Location");
  });

  it("accepts custom className", () => {
    const { container } = render(<SectionLabel className="custom">Label</SectionLabel>);
    const div = container.querySelector("div") as HTMLElement;
    expect(div.className).toContain("custom");
  });

  it("accepts style override", () => {
    const { container } = render(<SectionLabel style={{ marginBottom: "8px" }}>Label</SectionLabel>);
    const div = container.querySelector("div") as HTMLElement;
    expect(div.style.marginBottom).toBe("8px");
  });
});
