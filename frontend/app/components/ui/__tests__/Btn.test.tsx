import React from "react";
import { render } from "@testing-library/react";
import { Btn } from "../Btn";

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

  it("variant='accent' sets background var(--accent) via inline style", () => {
    const { container } = render(<Btn variant="accent">Go</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.style.background).toBe("var(--accent)");
  });

  it("variant='secondary' sets background var(--surface) via inline style", () => {
    const { container } = render(<Btn variant="secondary">Cancel</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.style.background).toBe("var(--surface)");
  });

  it("variant='secondary' sets border '1px solid var(--border-strong)' via inline style", () => {
    const { container } = render(<Btn variant="secondary">Cancel</Btn>);
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.style.border).toBe("1px solid var(--border-strong)");
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
});
