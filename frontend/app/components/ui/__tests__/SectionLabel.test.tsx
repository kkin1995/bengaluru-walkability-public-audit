import React from "react";
import { render } from "@testing-library/react";
import { SectionLabel } from "../SectionLabel";

describe("SectionLabel", () => {
  it("renders a div element", () => {
    const { container } = render(<SectionLabel>Reports</SectionLabel>);
    expect(container.querySelector("div")).not.toBeNull();
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

  it("sets fontFamily var(--font-mono) via inline style", () => {
    const { container } = render(<SectionLabel>Reports</SectionLabel>);
    const div = container.querySelector("div") as HTMLElement;
    expect(div.style.fontFamily).toBe("var(--font-mono)");
  });

  it("sets color var(--muted) via inline style", () => {
    const { container } = render(<SectionLabel>Reports</SectionLabel>);
    const div = container.querySelector("div") as HTMLElement;
    expect(div.style.color).toBe("var(--muted)");
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
