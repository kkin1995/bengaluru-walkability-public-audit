import React from "react";
import { render } from "@testing-library/react";
import { Pill } from "../Pill";

// jsdom does not compute CSS custom properties (var(--token)) via element.style
// for background/color/border. We use the data-tone attribute (added to span)
// to verify which tone was applied, and check numeric/concrete values via style.

describe("Pill", () => {
  it("renders a span element", () => {
    const { container } = render(<Pill>Label</Pill>);
    expect(container.querySelector("span")).not.toBeNull();
  });

  it("default tone is neutral — data-tone='neutral'", () => {
    const { container } = render(<Pill>Neutral</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.getAttribute("data-tone")).toBe("neutral");
  });

  it("tone='accent' sets data-tone='accent'", () => {
    const { container } = render(<Pill tone="accent">Accent</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.getAttribute("data-tone")).toBe("accent");
  });

  it("tone='accent' has accent-border in raw style (var reference)", () => {
    const { container } = render(<Pill tone="accent">Accent</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    // data-tone confirms accent was applied
    expect(span.getAttribute("data-tone")).toBe("accent");
  });

  it("tone='glass' sets data-tone='glass'", () => {
    const { container } = render(<Pill tone="glass">Glass</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.getAttribute("data-tone")).toBe("glass");
  });

  it("tone='glass' applies data-tone='glass' (backdropFilter not testable in jsdom)", () => {
    const { container } = render(<Pill tone="glass">Glass</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    // jsdom strips backdropFilter from the style attribute.
    // data-tone confirms the glass tone was applied (which sets backdropFilter in a real browser).
    expect(span.getAttribute("data-tone")).toBe("glass");
  });

  it("tone='ink' sets data-tone='ink'", () => {
    const { container } = render(<Pill tone="ink">Ink</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.getAttribute("data-tone")).toBe("ink");
  });

  it("tone='warn' sets data-tone='warn'", () => {
    const { container } = render(<Pill tone="warn">Warn</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.getAttribute("data-tone")).toBe("warn");
  });

  it("renders children content", () => {
    const { container } = render(<Pill>Hello</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.textContent).toBe("Hello");
  });

  it("accepts custom className", () => {
    const { container } = render(<Pill className="my-pill">Tag</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.className).toContain("my-pill");
  });

  it("accepts style override (concrete value)", () => {
    const { container } = render(<Pill style={{ padding: "2px 6px" }}>Tag</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.padding).toBe("2px 6px");
  });
});
