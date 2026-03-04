/**
 * Tests for frontend/app/components/SubmitSuccess.tsx
 *
 * Requirements covered:
 *   R4 — Details & Submit
 *   AC4.4 — On success → SubmitSuccess replaces wizard (tested in report-page.test)
 *
 * Direct component tests:
 *   - Heading text "Report received"
 *   - Subheading text
 *   - "View on Map" link points to /map
 *   - "Share this app" uses Web Share API when available
 *   - "Share this app" falls back to clipboard + alert when navigator.share absent
 *   - "Submit another report" calls onReset
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubmitSuccess from "../SubmitSuccess";

// next/link renders an <a> tag in tests
jest.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

// ─────────────────────────────────────────────────────────────────────────────
// Static copy
// ─────────────────────────────────────────────────────────────────────────────
describe("SubmitSuccess — static copy", () => {
  it("renders heading 'Report received'", () => {
    render(<SubmitSuccess onReset={jest.fn()} />);
    expect(
      screen.getByRole("heading", { name: /report received/i })
    ).toBeInTheDocument();
  });

  it("renders subheading 'Thank you. Your report is visible on the public map.'", () => {
    render(<SubmitSuccess onReset={jest.fn()} />);
    expect(
      screen.getByText(/your report is visible on the public map/i)
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// "View on Map" button
// ─────────────────────────────────────────────────────────────────────────────
describe("SubmitSuccess — View on Map link", () => {
  it("renders a link with text 'View on Map'", () => {
    render(<SubmitSuccess onReset={jest.fn()} />);
    expect(screen.getByRole("link", { name: /view on map/i })).toBeInTheDocument();
  });

  it("'View on Map' href is '/map'", () => {
    render(<SubmitSuccess onReset={jest.fn()} />);
    const link = screen.getByRole("link", { name: /view on map/i });
    expect(link).toHaveAttribute("href", "/map");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// "Share this app" — navigator.share path
// ─────────────────────────────────────────────────────────────────────────────
describe("SubmitSuccess — Share this app (Web Share API)", () => {
  it("calls navigator.share when Web Share API is available", async () => {
    const mockShare = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: mockShare,
      writable: true,
      configurable: true,
    });

    render(<SubmitSuccess onReset={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /share this app/i }));

    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Bengaluru"),
        url: expect.any(String),
      })
    );
  });

  it("does NOT call clipboard.writeText when navigator.share is available", async () => {
    const mockShare = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: mockShare,
      writable: true,
      configurable: true,
    });

    render(<SubmitSuccess onReset={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /share this app/i }));

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// "Share this app" — clipboard fallback (no navigator.share)
// ─────────────────────────────────────────────────────────────────────────────
describe("SubmitSuccess — Share this app (clipboard fallback)", () => {
  beforeEach(() => {
    // Ensure navigator.share is undefined for these tests
    Object.defineProperty(navigator, "share", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it("falls back to clipboard.writeText when navigator.share is unavailable", async () => {
    render(<SubmitSuccess onReset={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /share this app/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it("shows alert 'Link copied to clipboard!' after clipboard write", async () => {
    render(<SubmitSuccess onReset={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /share this app/i }));

    expect(window.alert).toHaveBeenCalledWith("Link copied to clipboard!");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// "Submit another report" resets the wizard
// ─────────────────────────────────────────────────────────────────────────────
describe("SubmitSuccess — Submit another report", () => {
  it("renders a button with text 'Submit another report'", () => {
    render(<SubmitSuccess onReset={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: /submit another report/i })
    ).toBeInTheDocument();
  });

  it("calls onReset when 'Submit another report' is clicked", async () => {
    const onReset = jest.fn();
    render(<SubmitSuccess onReset={onReset} />);

    await userEvent.click(
      screen.getByRole("button", { name: /submit another report/i })
    );

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onReset on initial render — AC4.4 reset only on explicit click", () => {
    const onReset = jest.fn();
    render(<SubmitSuccess onReset={onReset} />);
    expect(onReset).not.toHaveBeenCalled();
  });
});
