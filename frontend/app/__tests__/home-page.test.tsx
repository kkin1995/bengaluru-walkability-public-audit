/**
 * Tests for frontend/app/page.tsx — Walkable BLR Home page (Phase 02.3.1 redesign)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import HomePage from "../page";

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

// Mock next/navigation — ReportCTA uses useRouter for programmatic navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}));

describe("Home page — Walkable BLR redesign (Phase 02.3.1)", () => {
  describe("Brand header", () => {
    it("renders Namma brand text", () => {
      render(<HomePage />);
      expect(screen.getByText(/Namma/)).toBeInTheDocument();
    });

    it("renders Kannada ದಾರಿ alongside Namma", () => {
      render(<HomePage />);
      expect(screen.getByText("ದಾರಿ")).toBeInTheDocument();
    });

    it("renders Walkable BLR mono tagline", () => {
      render(<HomePage />);
      expect(screen.getByText("Walkable BLR")).toBeInTheDocument();
    });

    it("renders language toggle display text (EN · ಕ)", () => {
      render(<HomePage />);
      expect(screen.getByText(/EN · ಕ/)).toBeInTheDocument();
    });
  });

  describe("Hero", () => {
    it("renders SectionLabel: Citizen Audit · ನಾಗರಿಕ", () => {
      render(<HomePage />);
      expect(screen.getByText("Citizen Audit · ನಾಗರಿಕ")).toBeInTheDocument();
    });

    it("renders h1: Fix the footpath.", () => {
      render(<HomePage />);
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent("Fix the footpath.");
    });

    it("renders subtext about snapping a photo", () => {
      render(<HomePage />);
      expect(
        screen.getByText(/Spot a broken, blocked, or missing footpath/)
      ).toBeInTheDocument();
    });
  });

  describe("Map preview", () => {
    it("Open map link points to /map", () => {
      render(<HomePage />);
      const links = screen.getAllByRole("link");
      const mapLink = links.find((l) => l.getAttribute("href") === "/map");
      expect(mapLink).toBeDefined();
      expect(mapLink).toHaveTextContent(/Open map/);
    });

    it("renders report count pill with 412", () => {
      render(<HomePage />);
      expect(screen.getByText("412")).toBeInTheDocument();
    });
  });

  describe("Primary CTA", () => {
    it("renders a file input for camera capture (ReportCTA — not a link to /report)", () => {
      render(<HomePage />);
      // CTA is now a label wrapping a hidden file input with capture="environment"
      const cameraInput = document.querySelector('input[type="file"][capture="environment"]');
      expect(cameraInput).not.toBeNull();
    });

    it("has English copy 'Report an issue' (lowercase i)", () => {
      render(<HomePage />);
      expect(screen.getByText("Report an issue")).toBeInTheDocument();
    });

    it("has Kannada copy 'ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ'", () => {
      render(<HomePage />);
      expect(screen.getByText("ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ")).toBeInTheDocument();
    });
  });

  describe("Trust sub-copy", () => {
    it("renders 'No login'", () => {
      render(<HomePage />);
      expect(screen.getByText("No login")).toBeInTheDocument();
    });

    it("renders 'Takes 20 seconds'", () => {
      render(<HomePage />);
      expect(screen.getByText("Takes 20 seconds")).toBeInTheDocument();
    });

    it("renders 'Anonymous'", () => {
      render(<HomePage />);
      expect(screen.getByText("Anonymous")).toBeInTheDocument();
    });
  });

  describe("Removed from old design (regression guards)", () => {
    it("no longer has data-testid 'trust-pills'", () => {
      render(<HomePage />);
      expect(screen.queryByTestId("trust-pills")).toBeNull();
    });

    it("no longer has old capital 'Report an Issue' heading", () => {
      render(<HomePage />);
      expect(screen.queryByText("Report an Issue")).toBeNull();
    });
  });
});
