import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuccessCard } from "../SuccessCard";

describe("SuccessCard", () => {
  const defaultProps = {
    onReportAnother: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders h1 'Thank you. It\\'s on the map.'", () => {
    render(<SuccessCard {...defaultProps} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Thank you/i)).toBeInTheDocument();
  });

  it("renders 'Submitted' section label", () => {
    render(<SuccessCard {...defaultProps} />);
    // SectionLabel renders "Submitted"
    const submitted = screen.getAllByText("Submitted");
    expect(submitted.length).toBeGreaterThanOrEqual(1);
  });

  it("renders a check_circle icon in an accent-bg circle (aria-hidden container)", () => {
    render(<SuccessCard {...defaultProps} />);
    // The outer div wrapping the check_circle icon is aria-hidden
    const container = document.querySelector('[aria-hidden="true"]');
    expect(container).not.toBeNull();
  });

  it("renders Share button", () => {
    render(<SuccessCard {...defaultProps} />);
    expect(screen.getByText("Share")).toBeInTheDocument();
  });

  it("renders Report another button with Kannada text 'ಇನ್ನೊಂದು'", () => {
    render(<SuccessCard {...defaultProps} />);
    expect(screen.getByText("Report another")).toBeInTheDocument();
    expect(screen.getByText("ಇನ್ನೊಂದು")).toBeInTheDocument();
  });

  it("clicking Report another calls onReportAnother prop", () => {
    const onReportAnother = jest.fn();
    render(<SuccessCard {...defaultProps} onReportAnother={onReportAnother} />);
    fireEvent.click(screen.getByText("Report another"));
    expect(onReportAnother).toHaveBeenCalledTimes(1);
  });

  it("clicking Close (X) button calls onClose prop", () => {
    const onClose = jest.fn();
    render(<SuccessCard {...defaultProps} onClose={onClose} />);
    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("when reportId is provided, renders it in .mono class element", () => {
    render(<SuccessCard {...defaultProps} reportId="RPT-2024-001" />);
    const mono = document.querySelector(".mono");
    expect(mono).not.toBeNull();
    expect(mono?.textContent).toContain("RPT-2024-001");
  });

  it("when reportId is omitted, renders em dash placeholder gracefully", () => {
    render(<SuccessCard {...defaultProps} />);
    const mono = document.querySelector(".mono");
    expect(mono).not.toBeNull();
    expect(mono?.textContent).toContain("—");
  });

  it("renders Report ID section label", () => {
    render(<SuccessCard {...defaultProps} reportId="RPT-123" />);
    expect(screen.getByText("Report ID")).toBeInTheDocument();
  });

  it("renders 'Save for reference' text", () => {
    render(<SuccessCard {...defaultProps} />);
    expect(screen.getByText("Save for reference")).toBeInTheDocument();
  });

  it("renders locationLabel when provided", () => {
    render(<SuccessCard {...defaultProps} locationLabel="Koramangala, Bengaluru" />);
    expect(screen.getByText("Koramangala, Bengaluru")).toBeInTheDocument();
  });

  it("does not render Near section when locationLabel is not provided", () => {
    render(<SuccessCard {...defaultProps} />);
    expect(screen.queryByText("Near")).not.toBeInTheDocument();
  });

  it("renders 'Status' label with 'Submitted' status dot", () => {
    render(<SuccessCard {...defaultProps} />);
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders 'Auto-detected' when wardLabel is provided (FIX-12)", () => {
    // FIX-12: ward label source is always displayed as "Auto-detected", never "Auto-routed".
    render(<SuccessCard {...defaultProps} wardLabel="Shivajinagar" />);
    expect(screen.getByText("Auto-detected")).toBeInTheDocument();
    expect(screen.queryByText("Auto-routed")).not.toBeInTheDocument();
  });

  it("does NOT render 'Auto-routed' in any scenario (FIX-12 non-regression)", () => {
    // Adversarial: neither with nor without wardLabel should "Auto-routed" appear.
    const { rerender } = render(<SuccessCard {...defaultProps} />);
    expect(screen.queryByText("Auto-routed")).not.toBeInTheDocument();
    rerender(<SuccessCard {...defaultProps} wardLabel="Koramangala" />);
    expect(screen.queryByText("Auto-routed")).not.toBeInTheDocument();
  });
});
