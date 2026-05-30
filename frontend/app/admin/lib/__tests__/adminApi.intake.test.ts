/**
 * Tests for getIntakeStats in frontend/app/admin/lib/adminApi.ts (BUG-03.2-A).
 *
 * Requirements covered:
 *   BUG-03.2-A — getIntakeStats(days) fetches GET /api/admin/stats/intake?days=N
 *               with credentials: "include" and parses IntakeDayCount[] on 200.
 *
 * Mocking strategy:
 *   global.fetch replaced with jest.fn() in beforeEach.
 *   Each test controls the mock response independently.
 *   No real network calls are made.
 *
 * Determinism:
 *   No wall-clock time, random seeds, or external I/O.
 */

import * as adminApi from "../adminApi";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — copied verbatim from adminApi.phase2.test.ts (established pattern)
// ─────────────────────────────────────────────────────────────────────────────

function mockOkResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function lastFetchOptions(): RequestInit {
  const mockFetch = global.fetch as jest.Mock;
  const calls = mockFetch.mock.calls;
  expect(calls.length).toBeGreaterThanOrEqual(
    1,
    "Expected fetch() to have been called at least once"
  );
  return (calls[calls.length - 1][1] ?? {}) as RequestInit;
}

function lastFetchUrl(): string {
  const mockFetch = global.fetch as jest.Mock;
  const calls = mockFetch.mock.calls;
  return calls[calls.length - 1][0] as string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  global.fetch = jest.fn();
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-03.2-A — getIntakeStats URL + credentials + parsing
// ─────────────────────────────────────────────────────────────────────────────

describe("BUG-03.2-A — getIntakeStats sends correct request and parses response", () => {
  it("getIntakeStats(14) URL contains /api/admin/stats/intake?days=14", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse([]));

    await adminApi.getIntakeStats(14);

    const url = lastFetchUrl();
    expect(url).toMatch(
      /\/api\/admin\/stats\/intake\?days=14/,
      "getIntakeStats(14) must request /api/admin/stats/intake?days=14"
    );
  });

  it("getIntakeStats(7) URL contains days=7", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse([]));

    await adminApi.getIntakeStats(7);

    const url = lastFetchUrl();
    expect(url).toMatch(
      /days=7/,
      "getIntakeStats(7) URL must contain days=7"
    );
  });

  it("returns parsed IntakeDayCount[] on HTTP 200", async () => {
    const fixture = [
      { day: "2026-05-30", count: 5 },
      { day: "2026-05-29", count: 3 },
    ];
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(fixture));

    const result = await adminApi.getIntakeStats(14);

    expect(result).toEqual(fixture);
  });

  it("request includes credentials: include (via apiFetch)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse([]));

    await adminApi.getIntakeStats(30);

    const opts = lastFetchOptions();
    expect(opts.credentials).toBe(
      "include",
      "getIntakeStats must include credentials: 'include' so the admin JWT cookie is sent"
    );
  });
});
