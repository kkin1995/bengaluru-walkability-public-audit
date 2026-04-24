import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryGrid } from "../CategoryGrid";

describe("CategoryGrid", () => {
  it("renders 6 category buttons", () => {
    render(<CategoryGrid value="" onChange={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(6);
  });

  it("renders English bilingual labels for each category", () => {
    render(<CategoryGrid value="" onChange={() => {}} />);
    expect(screen.getByText("No path")).toBeInTheDocument();
    expect(screen.getByText("Damaged")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("Crossing")).toBeInTheDocument();
    expect(screen.getByText("Lighting")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("renders Kannada bilingual labels", () => {
    render(<CategoryGrid value="" onChange={() => {}} />);
    expect(screen.getByText("ಕಾಲ್ದಾರಿ ಇಲ್ಲ")).toBeInTheDocument();
    expect(screen.getByText("ಹಾಳಾದ")).toBeInTheDocument();
    expect(screen.getByText("ಮುಚ್ಚಿದ")).toBeInTheDocument();
    expect(screen.getByText("ಕ್ರಾಸಿಂಗ್")).toBeInTheDocument();
    expect(screen.getByText("ಬೆಳಕು")).toBeInTheDocument();
    expect(screen.getByText("ಇತರ")).toBeInTheDocument();
  });

  it("calls onChange with the clicked category value", () => {
    const onChange = jest.fn();
    render(<CategoryGrid value="" onChange={onChange} />);
    fireEvent.click(screen.getByText("Damaged"));
    expect(onChange).toHaveBeenCalledWith("broken_footpath");
  });

  it("calls onChange with no_footpath when No path is clicked", () => {
    const onChange = jest.fn();
    render(<CategoryGrid value="" onChange={onChange} />);
    fireEvent.click(screen.getByText("No path"));
    expect(onChange).toHaveBeenCalledWith("no_footpath");
  });

  it("calls onChange with blocked_footpath when Blocked is clicked", () => {
    const onChange = jest.fn();
    render(<CategoryGrid value="" onChange={onChange} />);
    fireEvent.click(screen.getByText("Blocked"));
    expect(onChange).toHaveBeenCalledWith("blocked_footpath");
  });

  it("calls onChange with unsafe_crossing when Crossing is clicked", () => {
    const onChange = jest.fn();
    render(<CategoryGrid value="" onChange={onChange} />);
    fireEvent.click(screen.getByText("Crossing"));
    expect(onChange).toHaveBeenCalledWith("unsafe_crossing");
  });

  it("calls onChange with poor_lighting when Lighting is clicked", () => {
    const onChange = jest.fn();
    render(<CategoryGrid value="" onChange={onChange} />);
    fireEvent.click(screen.getByText("Lighting"));
    expect(onChange).toHaveBeenCalledWith("poor_lighting");
  });

  it("calls onChange with other when Other is clicked", () => {
    const onChange = jest.fn();
    render(<CategoryGrid value="" onChange={onChange} />);
    fireEvent.click(screen.getByText("Other"));
    expect(onChange).toHaveBeenCalledWith("other");
  });

  it("active chip has aria-checked true", () => {
    render(<CategoryGrid value="broken_footpath" onChange={() => {}} />);
    const damagedBtn = screen.getByText("Damaged").closest("button");
    expect(damagedBtn).toHaveAttribute("aria-checked", "true");
  });

  it("inactive chips have aria-checked false", () => {
    render(<CategoryGrid value="broken_footpath" onChange={() => {}} />);
    const noPathBtn = screen.getByText("No path").closest("button");
    expect(noPathBtn).toHaveAttribute("aria-checked", "false");
  });

  it("active chip has var(--ink) background style", () => {
    render(<CategoryGrid value="broken_footpath" onChange={() => {}} />);
    const damagedBtn = screen.getByText("Damaged").closest("button");
    expect(damagedBtn).toHaveStyle({ background: "var(--ink)" });
  });

  it("inactive chip has var(--surface) background style", () => {
    render(<CategoryGrid value="" onChange={() => {}} />);
    const noPathBtn = screen.getByText("No path").closest("button");
    expect(noPathBtn).toHaveStyle({ background: "var(--surface)" });
  });

  it("active chip renders a check icon badge (positioned div with aria-hidden)", () => {
    render(<CategoryGrid value="no_footpath" onChange={() => {}} />);
    const noPathBtn = screen.getByText("No path").closest("button");
    // The check badge is a div with position absolute and aria-hidden, distinct from SVG icons
    const badge = noPathBtn?.querySelector('div[aria-hidden="true"]');
    expect(badge).not.toBeNull();
  });

  it("inactive chip does not render check icon badge div", () => {
    render(<CategoryGrid value="" onChange={() => {}} />);
    const noPathBtn = screen.getByText("No path").closest("button");
    // Only SVG icons are aria-hidden inside button; there should be no div[aria-hidden]
    const badge = noPathBtn?.querySelector('div[aria-hidden="true"]');
    expect(badge).toBeNull();
  });

  it("renders a radiogroup with aria-label", () => {
    render(<CategoryGrid value="" onChange={() => {}} />);
    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAttribute("aria-label", "Issue category");
  });

  it("no chip is active when value is empty string", () => {
    render(<CategoryGrid value="" onChange={() => {}} />);
    const radios = screen.getAllByRole("radio");
    radios.forEach((radio) => {
      expect(radio).toHaveAttribute("aria-checked", "false");
    });
  });
});
