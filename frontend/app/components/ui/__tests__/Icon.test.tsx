import React from "react";
import { render } from "@testing-library/react";
import { Icon } from "../Icon";
import type { IconName } from "../Icon";

const ALL_ICON_NAMES: IconName[] = [
  "camera", "map", "pin", "arrow_right", "arrow_left",
  "check", "check_circle", "close", "image", "flash",
  "flip", "crosshair", "edit", "send", "chevron_right",
  "chevron_down", "share", "grid", "list", "filter",
  "globe", "menu", "shield", "mic",
  "cat_no_path", "cat_broken", "cat_blocked", "cat_crossing",
  "cat_lighting", "cat_other", "cat_ramp", "cat_encroach",
];

describe("Icon", () => {
  it("renders svg with viewBox='0 0 24 24'", () => {
    const { container } = render(<Icon name="camera" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });

  it("renders at least one <g> element inside the svg", () => {
    const { container } = render(<Icon name="camera" />);
    const g = container.querySelector("svg g");
    expect(g).not.toBeNull();
  });

  it("cat_broken renders without throwing", () => {
    expect(() => render(<Icon name="cat_broken" />)).not.toThrow();
  });

  it("default size is 24 — svg width and height are 24", () => {
    const { container } = render(<Icon name="camera" />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg.style.width).toBe("24px");
    expect(svg.style.height).toBe("24px");
  });

  it("size=32 sets svg width and height to 32", () => {
    const { container } = render(<Icon name="camera" size={32} />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg.style.width).toBe("32px");
    expect(svg.style.height).toBe("32px");
  });

  it("sets aria-hidden=true by default", () => {
    const { container } = render(<Icon name="camera" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("when aria-label is provided, aria-hidden is removed and role=img is set", () => {
    const { container } = render(<Icon name="camera" aria-label="Take photo" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toHaveAttribute("aria-hidden");
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label", "Take photo");
  });

  it.each(ALL_ICON_NAMES)("icon '%s' renders without throwing", (name) => {
    expect(() => render(<Icon name={name} />)).not.toThrow();
  });

  it("there are exactly 32 icon names in ALL_ICON_NAMES", () => {
    expect(ALL_ICON_NAMES).toHaveLength(32);
  });
});
