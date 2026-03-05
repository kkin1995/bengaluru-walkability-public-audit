import React from "react";
import { render, screen } from "@testing-library/react";
import { BilingualText } from "../BilingualText";

describe("BilingualText", () => {
  it("renders the English text", () => {
    render(<BilingualText en="Report an Issue" kn="ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ" />);
    expect(screen.getByText("Report an Issue")).toBeInTheDocument();
  });

  it("renders the Kannada text", () => {
    render(<BilingualText en="Report an Issue" kn="ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ" />);
    expect(screen.getByText("ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ")).toBeInTheDocument();
  });

  it("applies custom enClass to the English span", () => {
    render(<BilingualText en="Next" kn="ಮುಂದೆ" enClass="text-xl font-bold" />);
    const enSpan = screen.getByText("Next");
    expect(enSpan).toHaveClass("text-xl", "font-bold");
  });

  it("applies custom knClass to the Kannada span", () => {
    render(<BilingualText en="Next" kn="ಮುಂದೆ" knClass="text-sm text-blue-400" />);
    const knSpan = screen.getByText("ಮುಂದೆ");
    expect(knSpan).toHaveClass("text-sm", "text-blue-400");
  });

  it("applies default enClass when not provided", () => {
    render(<BilingualText en="Next" kn="ಮುಂದೆ" />);
    const enSpan = screen.getByText("Next");
    expect(enSpan).toHaveClass("text-base", "font-semibold");
  });

  it("applies default knClass when not provided", () => {
    render(<BilingualText en="Next" kn="ಮುಂದೆ" />);
    const knSpan = screen.getByText("ಮುಂದೆ");
    // Kannada text must meet WCAG AA contrast: text-sm (14px) + text-gray-600 (#4b5563, ~5.9:1 ratio)
    expect(knSpan).toHaveClass("text-sm", "text-gray-600", "font-normal");
  });

  it("applies custom containerClass to the outer span", () => {
    render(<BilingualText en="Next" kn="ಮುಂದೆ" containerClass="inline-flex gap-1" />);
    const enSpan = screen.getByText("Next");
    const container = enSpan.parentElement;
    expect(container).toHaveClass("inline-flex", "gap-1");
  });
});
