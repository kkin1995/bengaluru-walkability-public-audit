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

  it("honeypot is type=hidden so browser autofill never fills it", () => {
    render(<ReportPage />);
    const honeypot = document.querySelector('input[data-hp="1"]') as HTMLInputElement | null;
    expect(honeypot).not.toBeNull();
    expect(honeypot!.type).toBe("hidden");
  });
});
