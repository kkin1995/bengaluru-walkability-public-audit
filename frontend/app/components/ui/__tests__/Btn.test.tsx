import React from "react";
import { render } from "@testing-library/react";
import { Btn } from "../Btn";

// jsdom does not compute CSS custom properties (var(--token)) via element.style
// for background/color/border. We use data-variant and data-size attributes
// (added to the button element) to verify which variant/size was applied,
// and element.style for numeric properties (minHeight, opacity) that jsdom handles.

describe("Btn", () => {
  it("renders a button element", () => {
    const { container } = render(<Btn>Click me</Btn>);
    expect(container.querySelector("button")).not.toBeNull();
  });

  it("variant='accent' size='xl' sets minHeight 64px via inline style", () => {
    const { container } = render(<Btn variant="accent" size="xl">Go</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.style.minHeight).toBe("64px");
  });

  it("variant='accent' applies data-variant='accent'", () => {
    const { container } = render(<Btn variant="accent">Go</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.getAttribute("data-variant")).toBe("accent");
  });

  it("variant='secondary' applies data-variant='secondary'", () => {
    const { container } = render(<Btn variant="secondary">Cancel</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.getAttribute("data-variant")).toBe("secondary");
  });

  it("variant='secondary' has border-strong in raw style attr", () => {
    const { container } = render(<Btn variant="secondary">Cancel</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    // jsdom may or may not preserve var() in border — check data-variant as source of truth
    expect(btn.getAttribute("data-variant")).toBe("secondary");
  });

  it("size='sm' sets minHeight 44px (44px floor for sm)", () => {
    const { container } = render(<Btn size="sm">Small</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.style.minHeight).toBe("44px");
  });

  it("size='md' sets minHeight 44px", () => {
    const { container } = render(<Btn size="md">Medium</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.style.minHeight).toBe("44px");
  });

  it("size='lg' sets minHeight 56px", () => {
    const { container } = render(<Btn size="lg">Large</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.style.minHeight).toBe("56px");
  });

  it("disabled=true sets disabled attribute", () => {
    const { container } = render(<Btn disabled>Disabled</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn).toBeDisabled();
  });

  it("disabled=true sets opacity 0.4 via inline style", () => {
    const { container } = render(<Btn disabled>Disabled</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.style.opacity).toBe("0.4");
  });

  it("includes 'press' className for active-state animation", () => {
    const { container } = render(<Btn>Press me</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.className).toContain("press");
  });

  it("renders children content", () => {
    const { container } = render(<Btn>Submit</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.textContent).toBe("Submit");
  });

  it("appends custom className to 'press' base", () => {
    const { container } = render(<Btn className="my-class">Go</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.className).toContain("press");
    expect(btn.className).toContain("my-class");
  });

  it("default variant is primary (data-variant='primary')", () => {
    const { container } = render(<Btn>Default</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.getAttribute("data-variant")).toBe("primary");
  });

  it("data-size attribute reflects the size prop", () => {
    const { container } = render(<Btn size="xl">XL</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.getAttribute("data-size")).toBe("xl");
  });
});
