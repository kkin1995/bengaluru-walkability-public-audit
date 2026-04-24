import React from "react";
<parameter name="content">import React from "react";
import { render } from "@testing-library/react";
import { Pill } from "../Pill";

describe("Pill", () => {
  it("renders a span element", () => {
    const { container } = render(<Pill>Label</Pill>);
    expect(container.querySelector("span")).not.toBeNull();
  });

  it("default tone is neutral — renders with var(--surface) background", () => {
    const { container } = render(<Pill>Neutral</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.background).toBe("var(--surface)");
  });

  it("tone='accent' sets background var(--accent-bg)", () => {
    const { container } = render(<Pill tone="accent">Accent</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.background).toBe("var(--accent-bg)");
  });

  it("tone='accent' sets border '1px solid var(--accent-border)'", () => {
    const { container } = render(<Pill tone="accent">Accent</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.border).toBe("1px solid var(--accent-border)");
  });

  it("tone='glass' sets backdropFilter with blur", () => {
    const { container } = render(<Pill tone="glass">Glass</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.backdropFilter).toContain("blur");
  });

  it("tone='ink' sets background var(--ink)", () => {
    const { container } = render(<Pill tone="ink">Ink</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.background).toBe("var(--ink)");
  });

  it("tone='warn' sets background var(--warn-bg)", () => {
    const { container } = render(<Pill tone="warn">Warn</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.background).toBe("var(--warn-bg)");
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

  it("accepts style override", () => {
    const { container } = render(<Pill style={{ padding: "2px 6px" }}>Tag</Pill>);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.padding).toBe("2px 6px");
  });
});
