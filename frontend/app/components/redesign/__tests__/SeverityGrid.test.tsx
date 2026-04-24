import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SeverityGrid } from "../SeverityGrid";

describe("SeverityGrid", () => {
  it("renders 3 severity buttons", () => {
    render(<SeverityGrid value="medium" onChange={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("renders English labels: Minor, Moderate, Urgent", () => {
    render(<SeverityGrid value="medium" onChange={() => {}} />);
    expect(screen.getByText("Minor")).toBeInTheDocument();
    expect(screen.getByText("Moderate")).toBeInTheDocument();
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("renders Kannada labels: ಸಣ್ಣ, ಮಧ್ಯಮ, ತುರ್ತು", () => {
    render(<SeverityGrid value="medium" onChange={() => {}} />);
    expect(screen.getByText("ಸಣ್ಣ")).toBeInTheDocument();
    expect(screen.getByText("ಮಧ್ಯಮ")).toBeInTheDocument();
    expect(screen.getByText("ತುರ್ತು")).toBeInTheDocument();
  });

  it("clicking a button calls onChange with the severity value", () => {
    const onChange = jest.fn();
    render(<SeverityGrid value="" onChange={onChange} />);
    fireEvent.click(screen.getByText("Minor"));
    expect(onChange).toHaveBeenCalledWith("low");
  });

  it("clicking Moderate calls onChange with 'medium'", () => {
    const onChange = jest.fn();
    render(<SeverityGrid value="" onChange={onChange} />);
    fireEvent.click(screen.getByText("Moderate"));
    expect(onChange).toHaveBeenCalledWith("medium");
  });

  it("clicking Urgent calls onChange with 'high'", () => {
    const onChange = jest.fn();
    render(<SeverityGrid value="" onChange={onChange} />);
    fireEvent.click(screen.getByText("Urgent"));
    expect(onChange).toHaveBeenCalledWith("high");
  });

  it("active low chip has aria-checked true", () => {
    render(<SeverityGrid value="low" onChange={() => {}} />);
    const minorBtn = screen.getByText("Minor").closest("button");
    expect(minorBtn).toHaveAttribute("aria-checked", "true");
  });

  it("active low chip uses var(--accent-bg) background", () => {
    render(<SeverityGrid value="low" onChange={() => {}} />);
    const minorBtn = screen.getByText("Minor").closest("button");
    expect(minorBtn).toHaveStyle({ background: "var(--accent-bg)" });
  });

  it("active medium chip uses var(--warn-bg) background", () => {
    render(<SeverityGrid value="medium" onChange={() => {}} />);
    const moderateBtn = screen.getByText("Moderate").closest("button");
    expect(moderateBtn).toHaveStyle({ background: "var(--warn-bg)" });
  });

  it("active high chip uses var(--danger-bg) background", () => {
    render(<SeverityGrid value="high" onChange={() => {}} />);
    const urgentBtn = screen.getByText("Urgent").closest("button");
    expect(urgentBtn).toHaveStyle({ background: "var(--danger-bg)" });
  });

  it("renders hint text for low severity: 'Inconvenient but passable'", () => {
    render(<SeverityGrid value="low" onChange={() => {}} />);
    expect(screen.getByText("Inconvenient but passable")).toBeInTheDocument();
  });

  it("renders hint text for medium severity: 'Risky for some pedestrians'", () => {
    render(<SeverityGrid value="medium" onChange={() => {}} />);
    expect(screen.getByText("Risky for some pedestrians")).toBeInTheDocument();
  });

  it("renders hint text for high severity: 'Immediate danger'", () => {
    render(<SeverityGrid value="high" onChange={() => {}} />);
    expect(screen.getByText("Immediate danger")).toBeInTheDocument();
  });

  it("renders empty hint text when no severity selected", () => {
    render(<SeverityGrid value="" onChange={() => {}} />);
    const hints = [
      "Inconvenient but passable",
      "Risky for some pedestrians",
      "Immediate danger",
    ];
    hints.forEach((hint) => {
      expect(screen.queryByText(hint)).not.toBeInTheDocument();
    });
  });

  it("renders a radiogroup with aria-label 'Severity'", () => {
    render(<SeverityGrid value="medium" onChange={() => {}} />);
    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAttribute("aria-label", "Severity");
  });

  it("inactive chips have aria-checked false", () => {
    render(<SeverityGrid value="low" onChange={() => {}} />);
    const moderateBtn = screen.getByText("Moderate").closest("button");
    expect(moderateBtn).toHaveAttribute("aria-checked", "false");
  });
});
