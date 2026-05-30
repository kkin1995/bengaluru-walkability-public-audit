/**
 * Tests for frontend/app/admin/page.tsx — Admin Dashboard
 *
 * Requirements covered:
 *   R-DASH-1 / AC-DASH-1-S1  — StatsCards rendered with live data from getStats()
 *   R-DASH-1 / AC-DASH-1-S2  — Zero values render as "0" not blank  (R-COMP-3)
 *   R-DASH-1 / AC-DASH-1-S3  — Skeleton loading state while data is fetching  (R-COMP-4)
 *   EC-FE-6                   — Stats API failure → error state + retry button (not zeros)
 *
 * Mocking strategy:
 *   - adminApi module is fully mocked so tests control what getStats() returns.
 *   - StatsCards is mocked to record the props it receives.
 *   - next/navigation (useRouter, useSearchParams) is mocked globally.
 *   - No real network calls are made.
 *
 * Determinism:
 *   - No wall-clock time or random seeds used.
 *   - waitFor() is used for async state changes; act() wraps user interactions.
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks — must be declared before imports of the module under test
// ─────────────────────────────────────────────────────────────────────────────

// Mock the entire adminApi module.
// Individual tests override specific functions via mockResolvedValueOnce.
jest.mock("../lib/adminApi", () => ({
  getStats: jest.fn(),
  getAdminReports: jest.fn(),
  getUsers: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  getMe: jest.fn(),
  getAdminReport: jest.fn(),
  updateReportStatus: jest.fn(),
  deleteReport: jest.fn(),
  createUser: jest.fn(),
  deactivateUser: jest.fn(),
}));

// StatsCards — mock so we can inspect the props passed to it.
// The mock renders data-testid attributes for assertions.
jest.mock("../components/StatsCards", () => {
  const MockStatsCards = ({
    stats,
    isLoading,
    isError,
    onRetry,
  }: {
    stats?: {
      total: number;
      submitted: number;
      under_review: number;
      resolved: number;
    } | null;
    isLoading?: boolean;
    isError?: boolean;
    onRetry?: () => void;
  }) => {
    if (isLoading) {
      return (
        <div data-testid="stats-cards-loading">
          {/* Skeleton placeholders — four items */}
          <div data-testid="stat-skeleton" />
          <div data-testid="stat-skeleton" />
          <div data-testid="stat-skeleton" />
          <div data-testid="stat-skeleton" />
        </div>
      );
    }
    if (isError) {
      return (
        <div data-testid="stats-cards-error">
          <button data-testid="stats-retry-button" onClick={onRetry}>
            Retry
          </button>
        </div>
      );
    }
    return (
      <div data-testid="stats-cards">
        <span data-testid="stat-total">{stats?.total ?? ""}</span>
        <span data-testid="stat-submitted">{stats?.submitted ?? ""}</span>
        <span data-testid="stat-under-review">{stats?.under_review ?? ""}</span>
        <span data-testid="stat-resolved">{stats?.resolved ?? ""}</span>
      </div>
    );
  };
  MockStatsCards.displayName = "MockStatsCards";
  return MockStatsCards;
});

// next/navigation stubs
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin",
}));

// ─────────────────────────────────────────────────────────────────────────────
// Import the module under test AFTER the mocks are declared
// ─────────────────────────────────────────────────────────────────────────────

import AdminDashboard from "../page";
import * as adminApi from "../lib/adminApi";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

// Phase 03 (D-03): by_status now uses 6-value lifecycle shape.
// Mapping: open→submitted, acknowledged+assigned+in_progress→under_review, resolved+closed→resolved
const STATS_FIXTURE = {
  total_reports: 142,
  by_status: { open: 38, acknowledged: 21, assigned: 20, in_progress: 20, resolved: 43, closed: 0 },
  by_category: {
    no_footpath: 20,
    broken_footpath: 40,
    blocked_footpath: 30,
    unsafe_crossing: 25,
    poor_lighting: 17,
    other: 10,
  },
  by_severity: { low: 50, medium: 60, high: 32 },
};

const ZERO_STATS_FIXTURE = {
  total_reports: 0,
  by_status: { open: 0, acknowledged: 0, assigned: 0, in_progress: 0, resolved: 0, closed: 0 },
  by_category: {
    no_footpath: 0,
    broken_footpath: 0,
    blocked_footpath: 0,
    unsafe_crossing: 0,
    poor_lighting: 0,
    other: 0,
  },
  by_severity: { low: 0, medium: 0, high: 0 },
};

// Default mock for getAdminReports — returns empty activity list unless overridden.
// Required because page.tsx now fetches recent reports on mount alongside stats.
beforeEach(() => {
  (adminApi.getAdminReports as jest.Mock).mockResolvedValue({ data: [], pagination: { page: 1, limit: 5, total_count: 0, total_pages: 0 } });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// R-DASH-1 / AC-DASH-1-S1 — StatsCards rendered with live data
// ─────────────────────────────────────────────────────────────────────────────

describe("R-DASH-1 / AC-DASH-1-S1 — Dashboard renders a heading and fetches stats", () => {
  it('renders a heading or title containing "Dashboard"', async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(STATS_FIXTURE);
    render(<AdminDashboard />);
    // The dashboard must contain some heading-level element or text with "dashboard"
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /dashboard/i })
      ).toBeInTheDocument(
        // message: 'Dashboard page must render a heading containing "Dashboard"'
      );
    });
  });

  it("calls getStats() on mount to populate StatsCards", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(STATS_FIXTURE);
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(adminApi.getStats).toHaveBeenCalledTimes(
        1,
        "Dashboard page must call getStats() exactly once on mount to load stat data"
      );
    });
  });

  it("renders StatsCards after stats data resolves", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(STATS_FIXTURE);
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("stats-cards")).toBeInTheDocument(
        "After getStats() resolves, the StatsCards component must appear in the DOM"
      );
    });
  });

  it("passes the total_reports value to StatsCards so it displays 142", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(STATS_FIXTURE);
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("stat-total").textContent).toBe(
        "142",
        "StatsCards must receive and display total_reports = 142"
      );
    });
  });

  it("passes submitted count (38) to StatsCards", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(STATS_FIXTURE);
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("stat-submitted").textContent).toBe(
        "38",
        "StatsCards must receive and display submitted = 38"
      );
    });
  });

  it("passes under_review count (61) to StatsCards", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(STATS_FIXTURE);
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("stat-under-review").textContent).toBe(
        "61",
        "StatsCards must receive and display under_review = 61"
      );
    });
  });

  it("passes resolved count (43) to StatsCards", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(STATS_FIXTURE);
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("stat-resolved").textContent).toBe(
        "43",
        "StatsCards must receive and display resolved = 43"
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R-COMP-3 / AC-DASH-1-S2 — Zero values render as "0" not blank
// ─────────────────────────────────────────────────────────────────────────────

describe("R-COMP-3 / AC-DASH-1-S2 — Zero stat values render as '0' not blank", () => {
  it("renders total as '0' (not empty string) when total_reports is 0", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(ZERO_STATS_FIXTURE);
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("stat-total").textContent).toBe(
        "0",
        "A total of zero must display as '0', not as an empty string or dash"
      );
    });
  });

  it("renders submitted as '0' when count is 0", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(ZERO_STATS_FIXTURE);
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("stat-submitted").textContent).toBe(
        "0",
        "A submitted count of zero must display as '0', not as blank"
      );
    });
  });

  it("renders under_review as '0' when count is 0", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(ZERO_STATS_FIXTURE);
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("stat-under-review").textContent).toBe(
        "0",
        "An under_review count of zero must display as '0'"
      );
    });
  });

  it("renders resolved as '0' when count is 0", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(ZERO_STATS_FIXTURE);
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("stat-resolved").textContent).toBe(
        "0",
        "A resolved count of zero must display as '0'"
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R-COMP-4 / AC-DASH-1-S3 — Skeleton loading state while data is fetching
// ─────────────────────────────────────────────────────────────────────────────

describe("R-COMP-4 / AC-DASH-1-S3 — Skeleton loading state before stats data arrives", () => {
  it("renders the skeleton loading state immediately on mount before getStats() resolves", async () => {
    // getStats() never resolves during this test — simulates slow network
    (adminApi.getStats as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
    render(<AdminDashboard />);
    // Skeleton must be visible before data arrives
    expect(screen.getByTestId("stats-cards-loading")).toBeInTheDocument(
      "Dashboard must show a skeleton loading state while the stats API call is in-flight"
    );
  });

  it("skeleton has four placeholder elements (one per stat card)", async () => {
    (adminApi.getStats as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
    render(<AdminDashboard />);
    const skeletons = screen.getAllByTestId("stat-skeleton");
    expect(skeletons.length).toBe(
      4,
      "Skeleton loading state must render exactly 4 placeholder elements — one for each stat card"
    );
  });

  it("no numeric stat values are visible during loading", async () => {
    (adminApi.getStats as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
    render(<AdminDashboard />);
    // The actual stats container must not be in the DOM while loading
    expect(screen.queryByTestId("stats-cards")).not.toBeInTheDocument(
      "StatsCards with actual data must not render until getStats() resolves"
    );
  });

  it("skeleton is replaced by real stats after getStats() resolves", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(STATS_FIXTURE);
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.queryByTestId("stats-cards-loading")).not.toBeInTheDocument(
        "Skeleton must be removed once stats data has loaded"
      );
      expect(screen.getByTestId("stats-cards")).toBeInTheDocument(
        "Real StatsCards must appear after the loading state ends"
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EC-FE-6 — Stats API failure renders error state with retry, not zeros
// ─────────────────────────────────────────────────────────────────────────────

describe("EC-FE-6 — getStats() failure shows error state with retry button, not zeros", () => {
  it("renders an error state when getStats() rejects", async () => {
    (adminApi.getStats as jest.Mock).mockRejectedValueOnce(
      new Error("500 Internal Server Error")
    );
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("stats-cards-error")).toBeInTheDocument(
        "When getStats() rejects, StatsCards must show an error state — not zeros"
      );
    });
  });

  it("error state includes a retry button", async () => {
    (adminApi.getStats as jest.Mock).mockRejectedValueOnce(
      new Error("Network failure")
    );
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByTestId("stats-retry-button")).toBeInTheDocument(
        "Error state must include a retry button so the admin can reload stats"
      );
    });
  });

  it("clicking retry calls getStats() again", async () => {
    (adminApi.getStats as jest.Mock)
      .mockRejectedValueOnce(new Error("Network failure"))
      .mockResolvedValueOnce(STATS_FIXTURE);

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("stats-retry-button")).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId("stats-retry-button"));
    });

    await waitFor(() => {
      expect(adminApi.getStats).toHaveBeenCalledTimes(
        2,
        "Clicking retry must trigger a second call to getStats()"
      );
    });
  });

  it("zero values are NOT shown when the API errors — error state replaces skeleton", async () => {
    (adminApi.getStats as jest.Mock).mockRejectedValueOnce(
      new Error("500 Internal Server Error")
    );
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.queryByTestId("stats-cards")).not.toBeInTheDocument(
        "Normal StatsCards with values must NOT render when getStats() fails"
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 03.2 / BUG-03.1-B — Period filter buttons are clickable (D-01, D-02)
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 03.2 / BUG-03.1-B — Period filter buttons change active state", () => {
  it("renders period buttons 7D, 14D, 30D", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(STATS_FIXTURE);
    render(<AdminDashboard />);
    await waitFor(() => {
      expect(screen.getByText("7D")).toBeInTheDocument();
      expect(screen.getByText("14D")).toBeInTheDocument();
      expect(screen.getByText("30D")).toBeInTheDocument();
    });
  });

  it("14D button is active (data-tone=accent) by default", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(STATS_FIXTURE);
    render(<AdminDashboard />);
    await waitFor(() => {
      const pill14D = screen.getByText("14D").closest("[data-component='pill']") as HTMLElement | null;
      expect(pill14D?.getAttribute("data-tone")).toBe("accent");
    });
  });

  it("clicking 7D button changes active period: 7D pill gets data-tone=accent", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(STATS_FIXTURE);
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("7D")).toBeInTheDocument();
    });

    await act(async () => {
      const btn7D = screen.getByText("7D").closest("button");
      if (btn7D) {
        await userEvent.click(btn7D);
      }
    });

    await waitFor(() => {
      const pill7D = screen.getByText("7D").closest("[data-component='pill']") as HTMLElement | null;
      expect(pill7D?.getAttribute("data-tone")).toBe("accent");
      // 14D should no longer be accent
      const pill14D = screen.getByText("14D").closest("[data-component='pill']") as HTMLElement | null;
      expect(pill14D?.getAttribute("data-tone")).toBe("outline");
    });
  });

  it("clicking 30D button changes active period: 30D pill gets data-tone=accent", async () => {
    (adminApi.getStats as jest.Mock).mockResolvedValueOnce(STATS_FIXTURE);
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("30D")).toBeInTheDocument();
    });

    await act(async () => {
      const btn30D = screen.getByText("30D").closest("button");
      if (btn30D) {
        await userEvent.click(btn30D);
      }
    });

    await waitFor(() => {
      const pill30D = screen.getByText("30D").closest("[data-component='pill']") as HTMLElement | null;
      expect(pill30D?.getAttribute("data-tone")).toBe("accent");
      // 14D should no longer be accent
      const pill14D = screen.getByText("14D").closest("[data-component='pill']") as HTMLElement | null;
      expect(pill14D?.getAttribute("data-tone")).toBe("outline");
    });
  });
});
