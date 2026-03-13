/**
 * ABUSE-02: Honeypot field automation test.
 * Verifies the hidden website input is present in the DOM with CSS off-screen hiding
 * (position:absolute; left:-9999px) and tabIndex=-1.
 * Using CSS positioning (not display:none) prevents sophisticated bots from detecting
 * the honeypot via computed style inspection.
 */
import React from "react";
import { render } from "@testing-library/react";
import ReportPage from "../page";

// Mock heavy deps that don't affect honeypot rendering
jest.mock("@/app/components/LocationMap", () => () => <div data-testid="map-mock" />);
jest.mock("@/app/components/PhotoCapture", () => () => <div data-testid="photo-mock" />);

// Mock ReviewStrip to avoid geocode network calls
jest.mock("@/app/components/ReviewStrip", () => () => <div data-testid="review-strip-mock" />);

// Mock SubmitSuccess to avoid rendering issues
jest.mock("@/app/components/SubmitSuccess", () => () => <div data-testid="submit-success-mock" />);

describe("ABUSE-02: honeypot field", () => {
  it("renders hidden website input with off-screen CSS positioning", () => {
    render(<ReportPage />);
    const honeypot = document.querySelector('input[name="website"]') as HTMLInputElement | null;
    expect(honeypot).not.toBeNull();
    expect(honeypot!.tabIndex).toBe(-1);
    expect(honeypot!.style.position).toBe("absolute");
    expect(parseInt(honeypot!.style.left, 10)).toBeLessThan(0);
  });

  it("honeypot input is not display:none (bots detect display:none)", () => {
    render(<ReportPage />);
    const honeypot = document.querySelector('input[name="website"]') as HTMLInputElement | null;
    expect(honeypot).not.toBeNull();
    expect(honeypot!.style.display).not.toBe("none");
    expect(honeypot!.style.visibility).not.toBe("hidden");
  });
});
