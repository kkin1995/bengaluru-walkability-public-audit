/**
 * Tests for frontend/app/page.tsx — Coming Soon page (Phase 06 / LAUNCH-01)
 *
 * The home page on the `main` branch is the coming soon page.
 * These tests replaced the old citizen home page tests when page.tsx was
 * replaced in Phase 06 Plan 05.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import ComingSoonPage from "../page";

function renderPage() {
  return render(<ComingSoonPage />);
}

describe("Coming soon page (Phase 06 / LAUNCH-01)", () => {
  describe("Metadata", () => {
    it("page component renders without crashing", () => {
      expect(() => renderPage()).not.toThrow();
    });
  });

  describe("Wordmark", () => {
    it("renders English wordmark 'Namma Daari'", () => {
      renderPage();
      expect(screen.getByText("Namma Daari")).toBeInTheDocument();
    });

    it("renders Kannada wordmark 'ನಮ್ಮ ದಾರಿ' in wordmark", () => {
      renderPage();
      // There are two instances: wordmark and taglineKn — both should be present
      const elements = screen.getAllByText("ನಮ್ಮ ದಾರಿ");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Status chip", () => {
    it("renders 'Coming soon · Bengaluru' status chip", () => {
      renderPage();
      expect(screen.getByText(/Coming soon · Bengaluru/)).toBeInTheDocument();
    });
  });

  describe("Eyebrow", () => {
    it("renders eyebrow text about citizen reporting", () => {
      renderPage();
      expect(
        screen.getByText(/Citizen reporting for/i)
      ).toBeInTheDocument();
    });

    it("renders 'walkable streets' accent span in eyebrow", () => {
      renderPage();
      expect(screen.getByText("walkable streets")).toBeInTheDocument();
    });
  });

  describe("Tagline", () => {
    it("renders h1 with tagline text", () => {
      renderPage();
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent(/Snap a broken footpath/);
    });

    it("renders soft segment of tagline", () => {
      renderPage();
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent(/Put it on Bengaluru/);
    });

    it("renders Kannada tagline 'ನಮ್ಮ ದಾರಿ'", () => {
      renderPage();
      const elements = screen.getAllByText(/ನಮ್ಮ ದಾರಿ/);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it("renders transliteration 'namma daari · our path'", () => {
      renderPage();
      expect(screen.getByText(/namma daari · our path/i)).toBeInTheDocument();
    });
  });

  describe("Description", () => {
    it("renders description paragraph", () => {
      renderPage();
      expect(
        screen.getByText(/Namma Daari turns a quick phone photo/)
      ).toBeInTheDocument();
    });

    it("renders bold 'Every report lands in front of BBMP / GBA'", () => {
      renderPage();
      expect(
        screen.getByText("Every report lands in front of BBMP / GBA")
      ).toBeInTheDocument();
    });
  });

  describe("Instagram CTA", () => {
    it("renders Instagram CTA link pointing to nammadaariblr", () => {
      renderPage();
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "https://instagram.com/nammadaariblr");
    });

    it("CTA opens in new tab with rel=noopener", () => {
      renderPage();
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener");
    });

    it("renders '@nammadaariblr' handle in CTA", () => {
      renderPage();
      expect(screen.getByText("@nammadaariblr")).toBeInTheDocument();
    });

    it("renders CTA note about not being live yet", () => {
      renderPage();
      expect(
        screen.getByText(/We're not live yet/)
      ).toBeInTheDocument();
    });
  });

  describe("Footer", () => {
    it("renders 'Built for Bengaluru' footer text", () => {
      renderPage();
      expect(screen.getByText(/Built for Bengaluru/)).toBeInTheDocument();
    });

    it("renders all four category tags", () => {
      renderPage();
      expect(screen.getByText("Footpaths")).toBeInTheDocument();
      expect(screen.getByText("Crossings")).toBeInTheDocument();
      expect(screen.getByText("Lighting")).toBeInTheDocument();
      expect(screen.getByText("BBMP / GBA")).toBeInTheDocument();
    });
  });

  describe("Regression guards — old citizen home page content must not appear", () => {
    it("does not render old 'Fix the footpath.' heading", () => {
      renderPage();
      expect(screen.queryByText("Fix the footpath.")).toBeNull();
    });

    it("does not render 'Walkable BLR' mono tagline", () => {
      renderPage();
      expect(screen.queryByText("Walkable BLR")).toBeNull();
    });

    it("does not render 'No login' trust sub-copy", () => {
      renderPage();
      expect(screen.queryByText("No login")).toBeNull();
    });

    it("does not render map link to /map", () => {
      renderPage();
      const links = screen.queryAllByRole("link");
      const mapLink = links.find((l) => l.getAttribute("href") === "/map");
      expect(mapLink).toBeUndefined();
    });
  });
});
