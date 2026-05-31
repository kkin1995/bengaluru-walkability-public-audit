/**
 * Smoke test for /stats page (ANALYTICS-01 / D-08).
 *
 * Verifies the page renders key stats elements without crashing:
 *   - Total reports count
 *   - Resolved count
 *   - "Download open data" link
 *
 * Does not require a live backend — fetch is mocked.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import StatsPage from "../page";

const MOCK_STATS = {
  total_reports: 123,
  resolved_count: 45,
  top_categories: [
    { category: "broken_footpath", cnt: 60 },
    { category: "blocked_footpath", cnt: 40 },
    { category: "no_footpath", cnt: 23 },
  ],
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => MOCK_STATS,
  }) as jest.Mock;
});

afterEach(() => {
  jest.clearAllMocks();
});

async function renderPage() {
  const element = await (StatsPage as () => Promise<React.ReactElement>)();
  return render(element);
}

describe("StatsPage", () => {
  it("renders total report count", async () => {
    await renderPage();
    expect(screen.getByText("123")).toBeInTheDocument();
  });

  it("renders resolved count", async () => {
    await renderPage();
    expect(screen.getByText("45")).toBeInTheDocument();
  });

  it("renders the open data download link", async () => {
    await renderPage();
    expect(screen.getByText(/Download open data/i)).toBeInTheDocument();
  });

  it("renders gracefully when fetch fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network error"));
    // Should not throw — renders unavailable state
    await expect(renderPage()).resolves.not.toThrow();
  });
});
