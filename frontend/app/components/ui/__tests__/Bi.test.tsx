import React from "react";
import { render, screen } from "@testing-library/react";
import { Bi } from "../Bi";

describe("Bi", () => {
  it("renders English in .bi-en span", () => {
    const { container } = render(<Bi en="Report" kn="ವರದಿ" />);
    const en = container.querySelector(".bi-en");
    expect(en).toHaveTextContent("Report");
  });

  it("renders Kannada in .bi-kn span when kn prop is provided", () => {
    const { container } = render(<Bi en="Report" kn="ವರದಿ" />);
    const kn = container.querySelector(".bi-kn");
    expect(kn).toHaveTextContent("ವರದಿ");
  });

  it("omits .bi-kn span when kn prop is undefined", () => {
    const { container } = render(<Bi en="Report" />);
    expect(container.querySelector(".bi-kn")).toBeNull();
  });

  it("appends custom className after .bi", () => {
    const { container } = render(<Bi en="X" className="custom" />);
    const span = container.querySelector("span.bi");
    expect(span?.className).toContain("custom");
  });

  it("renders outer span with .bi class", () => {
    const { container } = render(<Bi en="Hello" kn="ನಮಸ್ಕಾರ" />);
    const outer = container.querySelector("span.bi");
    expect(outer).not.toBeNull();
  });

  it("accepts style prop on outer span", () => {
    const { container } = render(<Bi en="Test" style={{ color: "red" }} />);
    const outer = container.querySelector("span.bi") as HTMLElement;
    expect(outer?.style.color).toBe("red");
  });
});
