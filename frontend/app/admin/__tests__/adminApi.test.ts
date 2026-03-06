/**
 * Tests for frontend/app/admin/lib/adminApi.ts
 *
 * Requirements covered:
 *   R-API-1 / AC-API-1-S1  — credentials: 'include' on every fetch call
 *   R-API-2 / AC-API-2-S1  — non-2xx response rejects the Promise
 *   R-API-2 / AC-API-2-S2  — 2xx response resolves with parsed JSON
 *   R-API-3 / AC-API-3-S1  — all 11 named exports are present and callable
 *
 * Mocking strategy:
 *   global.fetch is replaced with jest.fn() before each test.
 *   Individual tests set up mockResolvedValueOnce / mockRejectedValueOnce.
 *   No real network calls are made.
 *
 * Determinism:
 *   No wall-clock time, random seeds, or external I/O is used.
 *   Every assertion is self-contained.
 */

import * as adminApi from "../lib/adminApi";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal Response-like object that fetch() would return. */
function mockOkResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function mockErrorResponse(status: number, body: unknown = { error: "err" }): Response {
  return {
    ok: false,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** Capture the RequestInit options from the most recent fetch() call. */
function lastFetchOptions(): RequestInit {
  const mockFetch = global.fetch as jest.Mock;
  const calls = mockFetch.mock.calls;
  expect(calls.length).toBeGreaterThanOrEqual(
    1,
    "Expected fetch() to have been called at least once"
  );
  return (calls[calls.length - 1][1] ?? {}) as RequestInit;
}

/** Capture the URL from the most recent fetch() call. */
function lastFetchUrl(): string {
  const mockFetch = global.fetch as jest.Mock;
  const calls = mockFetch.mock.calls;
  return calls[calls.length - 1][0] as string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Replace global.fetch with a fresh jest.fn() before every test.
  // jest.setup.ts already installs a stub; here we reassign to a new mock
  // so we can track calls per-test without cross-contamination.
  global.fetch = jest.fn();
});

// jest.setup.ts calls jest.clearAllMocks() in afterEach — covers call history.

// ─────────────────────────────────────────────────────────────────────────────
// R-API-3 / AC-API-3-S1 — All 11 functions are exported and callable
// ─────────────────────────────────────────────────────────────────────────────

describe("R-API-3 / AC-API-3-S1 — All 11 named exports exist and are functions", () => {
  const requiredExports: (keyof typeof adminApi)[] = [
    "login",
    "logout",
    "getMe",
    "getAdminReports",
    "getAdminReport",
    "updateReportStatus",
    "deleteReport",
    "getStats",
    "getUsers",
    "createUser",
    "deactivateUser",
  ];

  for (const name of requiredExports) {
    it(`adminApi.${name} is exported as a callable function`, () => {
      expect(typeof adminApi[name]).toBe(
        "function",
        `Expected adminApi.${name} to be a function, got ${typeof adminApi[name]}`
      );
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// R-API-1 / AC-API-1-S1 — credentials: 'include' on every call
// ─────────────────────────────────────────────────────────────────────────────

describe("R-API-1 / AC-API-1-S1 — credentials: 'include' is sent on every fetch call", () => {
  it("login() passes credentials: 'include'", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({}));
    await adminApi.login("admin@test.com", "password123456").catch(() => {});
    expect(lastFetchOptions().credentials).toBe(
      "include",
      "login() must pass credentials: 'include' so the auth cookie is sent"
    );
  });

  it("logout() passes credentials: 'include'", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({}));
    await adminApi.logout().catch(() => {});
    expect(lastFetchOptions().credentials).toBe(
      "include",
      "logout() must pass credentials: 'include' so the auth cookie is sent"
    );
  });

  it("getMe() passes credentials: 'include'", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ id: "u1", email: "a@b.com", role: "admin" })
    );
    await adminApi.getMe().catch(() => {});
    expect(lastFetchOptions().credentials).toBe(
      "include",
      "getMe() must pass credentials: 'include'"
    );
  });

  it("getAdminReports() passes credentials: 'include'", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ data: [], pagination: { page: 1, limit: 20, total_count: 0, total_pages: 0 } })
    );
    await adminApi.getAdminReports().catch(() => {});
    expect(lastFetchOptions().credentials).toBe(
      "include",
      "getAdminReports() must pass credentials: 'include'"
    );
  });

  it("getAdminReport() passes credentials: 'include'", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({}));
    await adminApi.getAdminReport("some-id").catch(() => {});
    expect(lastFetchOptions().credentials).toBe(
      "include",
      "getAdminReport() must pass credentials: 'include'"
    );
  });

  it("updateReportStatus() passes credentials: 'include'", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({}));
    await adminApi.updateReportStatus("some-id", "resolved").catch(() => {});
    expect(lastFetchOptions().credentials).toBe(
      "include",
      "updateReportStatus() must pass credentials: 'include'"
    );
  });

  it("deleteReport() passes credentials: 'include'", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(null, 204));
    await adminApi.deleteReport("some-id").catch(() => {});
    expect(lastFetchOptions().credentials).toBe(
      "include",
      "deleteReport() must pass credentials: 'include'"
    );
  });

  it("getStats() passes credentials: 'include'", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ total_reports: 0, by_status: {}, by_category: {}, by_severity: {} })
    );
    await adminApi.getStats().catch(() => {});
    expect(lastFetchOptions().credentials).toBe(
      "include",
      "getStats() must pass credentials: 'include'"
    );
  });

  it("getUsers() passes credentials: 'include'", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse([]));
    await adminApi.getUsers().catch(() => {});
    expect(lastFetchOptions().credentials).toBe(
      "include",
      "getUsers() must pass credentials: 'include'"
    );
  });

  it("createUser() passes credentials: 'include'", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({}));
    await adminApi
      .createUser({ email: "x@y.com", password: "Password123456", role: "reviewer" })
      .catch(() => {});
    expect(lastFetchOptions().credentials).toBe(
      "include",
      "createUser() must pass credentials: 'include'"
    );
  });

  it("deactivateUser() passes credentials: 'include'", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(null, 204));
    await adminApi.deactivateUser("user-uuid").catch(() => {});
    expect(lastFetchOptions().credentials).toBe(
      "include",
      "deactivateUser() must pass credentials: 'include'"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R-API-2 / AC-API-2-S1 — non-2xx response rejects the Promise
// ─────────────────────────────────────────────────────────────────────────────

describe("R-API-2 / AC-API-2-S1 — non-2xx HTTP responses reject the returned Promise", () => {
  it("getUsers() rejects when the server returns 401", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrorResponse(401, { error: "Authentication required" })
    );
    await expect(adminApi.getUsers()).rejects.toBeTruthy(
      // message: "getUsers() must reject on 401 — caller cannot silently ignore auth errors"
    );
  });

  it("getUsers() rejection includes the HTTP status code 401", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrorResponse(401, { error: "Authentication required" })
    );
    let caughtError: unknown;
    try {
      await adminApi.getUsers();
    } catch (e) {
      caughtError = e;
    }
    // The thrown error must carry the status so callers can branch on 401 vs 403 etc.
    expect(String(caughtError)).toMatch(
      /401/,
      "Rejected error must contain the HTTP status 401 so callers can handle it specifically"
    );
  });

  it("getUsers() rejects when the server returns 403", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrorResponse(403, { error: "Forbidden" })
    );
    await expect(adminApi.getUsers()).rejects.toBeTruthy(
      // message: "getUsers() must reject on 403"
    );
  });

  it("getUsers() rejection includes the HTTP status code 403", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrorResponse(403, { error: "Forbidden" })
    );
    let caughtError: unknown;
    try {
      await adminApi.getUsers();
    } catch (e) {
      caughtError = e;
    }
    expect(String(caughtError)).toMatch(
      /403/,
      "Rejected error must contain the HTTP status 403"
    );
  });

  it("getStats() rejects when the server returns 500", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrorResponse(500, { error: "Internal Server Error" })
    );
    await expect(adminApi.getStats()).rejects.toBeTruthy(
      // message: "getStats() must reject on 500 — UI must show error state, not zeros"
    );
  });

  it("login() rejects when the server returns 401 (wrong credentials)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrorResponse(401, { error: "Invalid credentials" })
    );
    await expect(adminApi.login("bad@email.com", "wrongpassword")).rejects.toBeTruthy(
      // message: "login() must reject on 401 so LoginPage can display the error message"
    );
  });

  it("deleteReport() rejects when the server returns 403 (reviewer role)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrorResponse(403, { error: "Forbidden: admin role required" })
    );
    await expect(adminApi.deleteReport("report-id")).rejects.toBeTruthy(
      // message: "deleteReport() must reject on 403"
    );
  });

  it("createUser() rejects when the server returns 409 (duplicate email)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrorResponse(409, { error: "A user with this email already exists" })
    );
    await expect(
      adminApi.createUser({ email: "dup@test.com", password: "ValidPass2026!", role: "reviewer" })
    ).rejects.toBeTruthy(
      // message: "createUser() must reject on 409 so CreateUserModal shows the conflict message"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R-API-2 / AC-API-2-S2 — 2xx resolves with parsed JSON
// ─────────────────────────────────────────────────────────────────────────────

describe("R-API-2 / AC-API-2-S2 — 2xx HTTP responses resolve with the parsed JSON body", () => {
  it("getUsers() resolves with an array of user objects on HTTP 200", async () => {
    const users = [
      {
        id: "u-001",
        email: "admin@test.com",
        role: "admin",
        display_name: "Admin User",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        last_login_at: "2026-03-05T09:00:00Z",
      },
    ];
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(users));
    const result = await adminApi.getUsers();
    expect(result).toEqual(
      users,
      "getUsers() must resolve with the parsed JSON array returned by the API"
    );
  });

  it("getStats() resolves with the stats object on HTTP 200", async () => {
    const stats = {
      total_reports: 6,
      by_status: { submitted: 3, under_review: 2, resolved: 1 },
      by_category: {
        no_footpath: 0,
        broken_footpath: 4,
        blocked_footpath: 0,
        unsafe_crossing: 2,
        poor_lighting: 0,
        other: 0,
      },
      by_severity: { low: 1, medium: 3, high: 2 },
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(stats));
    const result = await adminApi.getStats();
    expect(result).toEqual(
      stats,
      "getStats() must resolve with the parsed stats object"
    );
  });

  it("getAdminReports() resolves with the paginated list on HTTP 200", async () => {
    const response = {
      data: [],
      pagination: { page: 1, limit: 20, total_count: 0, total_pages: 0 },
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(response));
    const result = await adminApi.getAdminReports();
    expect(result.pagination.page).toBe(
      1,
      "getAdminReports() must include a pagination object with page=1"
    );
    expect(Array.isArray(result.data)).toBe(
      true,
      "getAdminReports() must resolve with a data array"
    );
  });

  it("createUser() resolves with the new user object on HTTP 201", async () => {
    const newUser = {
      id: "u-new",
      email: "new@example.com",
      role: "reviewer",
      display_name: "New Reviewer",
      is_active: true,
      created_at: "2026-03-06T10:00:00Z",
      last_login_at: null,
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(newUser, 201));
    const result = await adminApi.createUser({
      email: "new@example.com",
      password: "SecurePass2026!",
      role: "reviewer",
      display_name: "New Reviewer",
    });
    expect(result).toEqual(
      newUser,
      "createUser() must resolve with the created user object returned by the 201 response"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HTTP method and URL contracts
// ─────────────────────────────────────────────────────────────────────────────

describe("HTTP method and URL routing", () => {
  it("login() calls POST /api/admin/auth/login", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({}));
    await adminApi.login("admin@test.com", "ValidPass2026!").catch(() => {});
    expect(lastFetchUrl()).toMatch(
      /\/api\/admin\/auth\/login$/,
      "login() must POST to /api/admin/auth/login"
    );
    expect(lastFetchOptions().method?.toUpperCase()).toBe(
      "POST",
      "login() must use the POST method"
    );
  });

  it("login() sends email and password in the request body as JSON", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({}));
    await adminApi.login("admin@test.com", "ValidPass2026!").catch(() => {});
    const body = JSON.parse(lastFetchOptions().body as string);
    expect(body.email).toBe(
      "admin@test.com",
      "login() body must include the email field"
    );
    expect(body.password).toBe(
      "ValidPass2026!",
      "login() body must include the password field"
    );
  });

  it("logout() calls POST /api/admin/auth/logout", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({}));
    await adminApi.logout().catch(() => {});
    expect(lastFetchUrl()).toMatch(
      /\/api\/admin\/auth\/logout$/,
      "logout() must POST to /api/admin/auth/logout"
    );
    expect(lastFetchOptions().method?.toUpperCase()).toBe(
      "POST",
      "logout() must use the POST method"
    );
  });

  it("getMe() calls GET /api/admin/auth/me", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ id: "u1", email: "a@b.com", role: "admin" })
    );
    await adminApi.getMe().catch(() => {});
    expect(lastFetchUrl()).toMatch(
      /\/api\/admin\/auth\/me$/,
      "getMe() must call GET /api/admin/auth/me"
    );
    // GET should not have a method override (defaults to GET), or explicitly be 'GET'
    const method = lastFetchOptions().method;
    if (method !== undefined) {
      expect(method.toUpperCase()).toBe("GET", "getMe() must use GET method");
    }
  });

  it("getAdminReports() calls GET /api/admin/reports", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ data: [], pagination: { page: 1, limit: 20, total_count: 0, total_pages: 0 } })
    );
    await adminApi.getAdminReports().catch(() => {});
    expect(lastFetchUrl()).toMatch(
      /\/api\/admin\/reports/,
      "getAdminReports() must call GET /api/admin/reports"
    );
  });

  it("getAdminReports() appends query params for category filter", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ data: [], pagination: { page: 1, limit: 20, total_count: 0, total_pages: 0 } })
    );
    await adminApi.getAdminReports({ category: "broken_footpath" }).catch(() => {});
    expect(lastFetchUrl()).toContain(
      "category=broken_footpath",
      "getAdminReports({ category }) must append ?category= to the URL"
    );
  });

  it("getAdminReports() appends query params for status and page filters", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ data: [], pagination: { page: 2, limit: 20, total_count: 0, total_pages: 0 } })
    );
    await adminApi.getAdminReports({ status: "under_review", page: 2 }).catch(() => {});
    const url = lastFetchUrl();
    expect(url).toContain(
      "status=under_review",
      "getAdminReports({ status }) must append ?status= to the URL"
    );
    expect(url).toContain(
      "page=2",
      "getAdminReports({ page }) must append ?page= to the URL"
    );
  });

  it("updateReportStatus() calls PATCH /api/admin/reports/:id/status", async () => {
    const reportId = "550e8400-e29b-41d4-a716-446655440000";
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({ id: reportId, status: "resolved" }));
    await adminApi.updateReportStatus(reportId, "resolved", "Closed").catch(() => {});
    expect(lastFetchUrl()).toMatch(
      new RegExp(`/api/admin/reports/${reportId}/status`),
      "updateReportStatus() must PATCH /api/admin/reports/:id/status"
    );
    expect(lastFetchOptions().method?.toUpperCase()).toBe(
      "PATCH",
      "updateReportStatus() must use the PATCH method"
    );
  });

  it("updateReportStatus() sends status and note in the request body", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({}));
    await adminApi
      .updateReportStatus("some-id", "under_review", "Assigned to team")
      .catch(() => {});
    const body = JSON.parse(lastFetchOptions().body as string);
    expect(body.status).toBe(
      "under_review",
      "updateReportStatus() body must include the status field"
    );
    expect(body.note).toBe(
      "Assigned to team",
      "updateReportStatus() body must include the note field when provided"
    );
  });

  it("updateReportStatus() omits note from body when not provided", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({}));
    await adminApi.updateReportStatus("some-id", "resolved").catch(() => {});
    const body = JSON.parse(lastFetchOptions().body as string);
    expect(body.status).toBe(
      "resolved",
      "updateReportStatus() body must include the status field even when note is omitted"
    );
    // note may be absent or null — both are acceptable
    expect("note" in body ? body.note : null).toBeFalsy(
      // message: "updateReportStatus() note must be null/undefined/absent when not provided"
    );
  });

  it("deleteReport() calls DELETE /api/admin/reports/:id", async () => {
    const reportId = "550e8400-e29b-41d4-a716-446655440000";
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(null, 204));
    await adminApi.deleteReport(reportId).catch(() => {});
    expect(lastFetchUrl()).toMatch(
      new RegExp(`/api/admin/reports/${reportId}$`),
      "deleteReport() must call DELETE /api/admin/reports/:id"
    );
    expect(lastFetchOptions().method?.toUpperCase()).toBe(
      "DELETE",
      "deleteReport() must use the DELETE method"
    );
  });

  it("getStats() calls GET /api/admin/stats", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ total_reports: 0, by_status: {}, by_category: {}, by_severity: {} })
    );
    await adminApi.getStats().catch(() => {});
    expect(lastFetchUrl()).toMatch(
      /\/api\/admin\/stats$/,
      "getStats() must call GET /api/admin/stats"
    );
  });

  it("getUsers() calls GET /api/admin/users", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse([]));
    await adminApi.getUsers().catch(() => {});
    expect(lastFetchUrl()).toMatch(
      /\/api\/admin\/users$/,
      "getUsers() must call GET /api/admin/users"
    );
  });

  it("createUser() calls POST /api/admin/users", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({}, 201));
    await adminApi
      .createUser({ email: "new@test.com", password: "Pass12345678!", role: "reviewer" })
      .catch(() => {});
    expect(lastFetchUrl()).toMatch(
      /\/api\/admin\/users$/,
      "createUser() must POST to /api/admin/users"
    );
    expect(lastFetchOptions().method?.toUpperCase()).toBe(
      "POST",
      "createUser() must use the POST method"
    );
  });

  it("createUser() sends email, password, and role in the request body as JSON", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({}, 201));
    await adminApi
      .createUser({
        email: "new@test.com",
        password: "SecurePass2026!",
        role: "admin",
        display_name: "New Admin",
      })
      .catch(() => {});
    const body = JSON.parse(lastFetchOptions().body as string);
    expect(body.email).toBe("new@test.com", "createUser() body must include email");
    expect(body.password).toBe("SecurePass2026!", "createUser() body must include password");
    expect(body.role).toBe("admin", "createUser() body must include role");
    expect(body.display_name).toBe(
      "New Admin",
      "createUser() body must include display_name when provided"
    );
  });

  it("deactivateUser() calls DELETE /api/admin/users/:id", async () => {
    const userId = "user-uuid-001";
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(null, 204));
    await adminApi.deactivateUser(userId).catch(() => {});
    expect(lastFetchUrl()).toMatch(
      new RegExp(`/api/admin/users/${userId}$`),
      "deactivateUser() must call DELETE /api/admin/users/:id"
    );
    expect(lastFetchOptions().method?.toUpperCase()).toBe(
      "DELETE",
      "deactivateUser() must use the DELETE method"
    );
  });
});
