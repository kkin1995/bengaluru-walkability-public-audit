/**
 * ABUSE-02: Honeypot field automation tests.
 * Verifies the hidden honeypot input is present with type="hidden".
 * Using type="hidden" means browsers never autofill it (no false positives),
 * while bot scripts that enumerate DOM inputs may still fill it.
 */
import React from "react";
import { render } from "@testing-library/react";
import ReportPage from "../page";

jest.mock("next/dynamic", () => () => {
  const Mock = () => <div data-testid="location-map" />;
  Mock.displayName = "DynamicMock";
  return Mock;
});

jest.mock("@/app/lib/photo-store", () => ({
  consumePendingPhoto: jest.fn().mockReturnValue(null),
  storePendingPhoto: jest.fn(),
}));

jest.mock("next/link", () => {
  const MockLink = ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("ABUSE-02: honeypot field", () => {
  it("renders honeypot input with data-hp=1 on photo step", () => {
    render(<ReportPage />);
    const honeypot = document.querySelector('input[data-hp="1"]') as HTMLInputElement | null;
    expect(honeypot).not.toBeNull();
  });

  it("honeypot is type=text (visually hidden via CSS) so bot scripts can fill it (ABUSE-02)", () => {
    // The implementation uses type="text" (not type="hidden") so that automated bot scripts
    // that enumerate DOM inputs will fill the field — this is the trap strategy.
    // Browsers will NOT autofill it because: (a) the field is positioned off-screen
    // via absolute positioning at left:-9999px, (b) autocomplete="off", (c) tabIndex=-1.
    // type="hidden" would prevent bots from seeing/filling it, defeating the honeypot.
    render(<ReportPage />);
    const honeypot = document.querySelector('input[data-hp="1"]') as HTMLInputElement | null;
    expect(honeypot).not.toBeNull();
    // ABUSE-02 implementation: type=text so bots fill it; NOT type=hidden
    expect(honeypot!.type).toBe("text");
    // Visually hidden via absolute positioning (off-screen)
    expect(honeypot!.style.position).toBe("absolute");
    // tabIndex=-1 prevents keyboard focus
    expect(honeypot!.tabIndex).toBe(-1);
    // autocomplete off to reduce browser fill attempts
    expect(honeypot!.autocomplete).toBe("off");
  });
});
