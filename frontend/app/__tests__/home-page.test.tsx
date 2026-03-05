/**
 * Tests for frontend/app/page.tsx — homepage
 *
 * P1-A: Trust copy & trust pills
 * P3: BilingualText (English + Kannada) on CTAs
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import HomePage from "../page";

jest.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-A: Mission statement
// ─────────────────────────────────────────────────────────────────────────────
describe("P1-A: Mission statement", () => {
  it("shows 'Your report helps prioritise fixes' text", () => {
    render(<HomePage />);
    expect(
      screen.getByText(/your report helps prioritise fixes/i)
    ).toBeInTheDocument();
  });

  it("shows 'You control what is shared' text", () => {
    render(<HomePage />);
    expect(
      screen.getByText(/you control what is shared/i)
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-A: Trust pills
// ─────────────────────────────────────────────────────────────────────────────
describe("P1-A: Trust pills", () => {
  it("renders trust pills container with 'No login'", () => {
    render(<HomePage />);
    const pills = screen.getByTestId("trust-pills");
    expect(pills).toHaveTextContent(/no login/i);
  });

  it("renders trust pills container with 'Public map'", () => {
    render(<HomePage />);
    const pills = screen.getByTestId("trust-pills");
    expect(pills).toHaveTextContent(/public map/i);
  });

  it("renders trust pills container with 'Open source'", () => {
    render(<HomePage />);
    const pills = screen.getByTestId("trust-pills");
    expect(pills).toHaveTextContent(/open source/i);
  });

  it("renders trust pills container with 'Privacy first'", () => {
    render(<HomePage />);
    const pills = screen.getByTestId("trust-pills");
    expect(pills).toHaveTextContent(/privacy first/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P1-A: View All Reports link still accessible
// ─────────────────────────────────────────────────────────────────────────────
describe("P1-A: View All Reports link", () => {
  it("'View All Reports' link is present and points to /map", () => {
    render(<HomePage />);
    const link = screen.getByRole("link", { name: /view all reports/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/map");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3: Bilingual CTAs
// ─────────────────────────────────────────────────────────────────────────────
describe("P3: Bilingual text on homepage CTAs", () => {
  it("'Report an Issue' primary CTA shows English text", () => {
    render(<HomePage />);
    expect(screen.getAllByText("Report an Issue").length).toBeGreaterThan(0);
  });

  it("'Report an Issue' primary CTA shows Kannada text", () => {
    render(<HomePage />);
    expect(screen.getByText("ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ")).toBeInTheDocument();
  });

  it("'View All Reports' secondary CTA shows Kannada text", () => {
    render(<HomePage />);
    expect(screen.getByText("ಎಲ್ಲ ವರದಿಗಳು ನೋಡಿ")).toBeInTheDocument();
  });
});
