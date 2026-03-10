/**
 * Phase 2 tests for frontend/app/admin/lib/adminApi.ts
 *
 * Requirements covered (from admin-phase2-ac.md — Feature 2: Admin Profile):
 *   PR-FE-1 / AC-PR-FE-1-S1 — updateProfile sends PATCH to /api/admin/auth/profile
 *   PR-FE-1 / AC-PR-FE-1-S2 — changePassword sends POST to /api/admin/auth/change-password
 *   PR-FE-1 / AC-PR-FE-1-F1 — updateProfile rejects on non-2xx (HTTP 400)
 *   PR-FE-1 / AC-PR-FE-1-F2 — changePassword rejects on 401 (wrong current password)
 *   RM-FE-8 / AC-RM-FE-8-S1 — getAdminReports({ limit: 200, page: 1 }) serialises both params correctly
 *
 * Additional contracts:
 *   - Both new functions include credentials: "include"
 *   - updateProfile with empty payload still sends PATCH (not skipped)
 *   - changePassword confirm_password is NOT sent to the API (frontend-only field)
 *
 * Mocking strategy:
 *   global.fetch replaced with jest.fn() in beforeEach.
 *   Each test controls the mock response independently.
 *   No real network calls are made.
 *
 * Determinism:
 *   No wall-clock time, random seeds, or external I/O.
 *
 * Implementation contract for impl agent:
 *   Add to adminApi.ts:
 *     export interface UpdateProfilePayload { display_name?: string | null }
 *     export interface ChangePasswordPayload { current_password: string; new_password: string }
 *     export async function updateProfile(data: UpdateProfilePayload): Promise<AdminUser>
 *       → PATCH ${BASE}/api/admin/auth/profile, JSON body, credentials: "include"
 *     export async function changePassword(data: ChangePasswordPayload): Promise<void>
 *       → POST ${BASE}/api/admin/auth/change-password, JSON body, credentials: "include"
 *
 * Do not modify tests. Tests are the behavioral contract.
 */

import * as adminApi from "../adminApi";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function mockNoContentResponse(): Response {
  return {
    ok: true,
    status: 204,
    json: async () => undefined,
    text: async () => "",
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

const ADMIN_USER_FIXTURE = {
  id: "user-uuid-001",
  email: "ops@example.com",
  role: "admin" as const,
  display_name: "Ops Lead",
  is_active: true,
  is_super_admin: false,
  created_at: "2026-01-01T00:00:00Z",
  last_login_at: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  global.fetch = jest.fn();
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-1 / AC-PR-FE-1-S1 — updateProfile: correct HTTP method, URL, body, credentials
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-1 / AC-PR-FE-1-S1 — updateProfile sends correct request", () => {
  it("calls fetch with PATCH method to /api/admin/auth/profile", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse(ADMIN_USER_FIXTURE)
    );

    await adminApi.updateProfile({ display_name: "New Name" });

    const url = lastFetchUrl();
    expect(url).toMatch(
      /\/api\/admin\/auth\/profile$/,
      "updateProfile must fetch URL ending in /api/admin/auth/profile"
    );

    const opts = lastFetchOptions();
    expect(opts.method).toBe(
      "PATCH",
      "updateProfile must use PATCH HTTP method, not POST or PUT"
    );
  });

  it("sends Content-Type: application/json header", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse(ADMIN_USER_FIXTURE)
    );

    await adminApi.updateProfile({ display_name: "New Name" });

    const opts = lastFetchOptions();
    const headers = opts.headers as Record<string, string>;
    expect(headers?.["Content-Type"]).toBe(
      "application/json",
      "updateProfile must send Content-Type: application/json header"
    );
  });

  it("sends credentials: 'include'", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse(ADMIN_USER_FIXTURE)
    );

    await adminApi.updateProfile({ display_name: "New Name" });

    const opts = lastFetchOptions();
    expect(opts.credentials).toBe(
      "include",
      "updateProfile must include credentials: 'include' to send the admin_token cookie"
    );
  });

  it("sends the display_name in the JSON body", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse(ADMIN_USER_FIXTURE)
    );

    await adminApi.updateProfile({ display_name: "New Name" });

    const opts = lastFetchOptions();
    const parsed = JSON.parse(opts.body as string);
    expect(parsed.display_name).toBe(
      "New Name",
      "updateProfile body must contain display_name field with the provided value"
    );
  });

  it("resolves to an AdminUser object on 200 response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse(ADMIN_USER_FIXTURE)
    );

    const result = await adminApi.updateProfile({ display_name: "New Name" });

    expect(result).toEqual(
      ADMIN_USER_FIXTURE,
      "updateProfile must return the parsed AdminUser from the 200 response body"
    );
  });

  it("sends PATCH even when payload is an empty object", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse(ADMIN_USER_FIXTURE)
    );

    await adminApi.updateProfile({});

    const opts = lastFetchOptions();
    expect(opts.method).toBe(
      "PATCH",
      "updateProfile with empty payload must still send a PATCH request (not skip the call)"
    );
  });

  it("sends null display_name correctly in body", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ ...ADMIN_USER_FIXTURE, display_name: null })
    );

    await adminApi.updateProfile({ display_name: null });

    const opts = lastFetchOptions();
    const parsed = JSON.parse(opts.body as string);
    // JSON.stringify({display_name: null}) → {"display_name":null}
    expect(parsed).toHaveProperty(
      "display_name",
      null,
      "updateProfile must serialise display_name: null as JSON null, not undefined or omitted"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-1 / AC-PR-FE-1-S2 — changePassword: correct HTTP method, URL, body, credentials
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-1 / AC-PR-FE-1-S2 — changePassword sends correct request", () => {
  it("calls fetch with POST method to /api/admin/auth/change-password", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ message: "COPY.admin.profile.passwordChanged" })
    );

    await adminApi.changePassword({
      current_password: "OldPass123!",
      new_password: "NewPass456!",
    });

    const url = lastFetchUrl();
    expect(url).toMatch(
      /\/api\/admin\/auth\/change-password$/,
      "changePassword must fetch URL ending in /api/admin/auth/change-password"
    );

    const opts = lastFetchOptions();
    expect(opts.method).toBe(
      "POST",
      "changePassword must use POST HTTP method"
    );
  });

  it("sends Content-Type: application/json header", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ message: "COPY.admin.profile.passwordChanged" })
    );

    await adminApi.changePassword({
      current_password: "OldPass123!",
      new_password: "NewPass456!",
    });

    const opts = lastFetchOptions();
    const headers = opts.headers as Record<string, string>;
    expect(headers?.["Content-Type"]).toBe(
      "application/json",
      "changePassword must send Content-Type: application/json"
    );
  });

  it("sends credentials: 'include'", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ message: "COPY.admin.profile.passwordChanged" })
    );

    await adminApi.changePassword({
      current_password: "OldPass123!",
      new_password: "NewPass456!",
    });

    const opts = lastFetchOptions();
    expect(opts.credentials).toBe(
      "include",
      "changePassword must include credentials: 'include' to send the admin_token cookie"
    );
  });

  it("sends both current_password and new_password in the JSON body", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ message: "COPY.admin.profile.passwordChanged" })
    );

    await adminApi.changePassword({
      current_password: "OldPass123!",
      new_password: "NewPass456!",
    });

    const opts = lastFetchOptions();
    const parsed = JSON.parse(opts.body as string);
    expect(parsed.current_password).toBe(
      "OldPass123!",
      "changePassword body must contain current_password field"
    );
    expect(parsed.new_password).toBe(
      "NewPass456!",
      "changePassword body must contain new_password field"
    );
  });

  it("does NOT send confirm_password in the body (frontend-only field per AC-PR-FE-4-S1)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ message: "COPY.admin.profile.passwordChanged" })
    );

    await adminApi.changePassword({
      current_password: "OldPass123!",
      new_password: "NewPass456!",
    });

    const opts = lastFetchOptions();
    const parsed = JSON.parse(opts.body as string);
    expect(parsed).not.toHaveProperty(
      "confirm_password",
      "confirm_password is a frontend-only field and must NOT be sent to the backend"
    );
  });

  it("resolves to void/undefined on 200 response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ message: "COPY.admin.profile.passwordChanged" })
    );

    const result = await adminApi.changePassword({
      current_password: "OldPass123!",
      new_password: "NewPass456!",
    });

    // changePassword returns Promise<void> — result should be undefined
    expect(result).toBeUndefined(
      "changePassword must return void (undefined) on success, not the response body"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-1 / AC-PR-FE-1-F1 — updateProfile rejects on non-2xx
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-1 / AC-PR-FE-1-F1 — updateProfile rejects on non-2xx HTTP status", () => {
  it("rejects with an error containing 'HTTP 400' when server returns 400", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrorResponse(400, {
        error: "VALIDATION_ERROR",
        message: "COPY.admin.profile.displayNameTooLong",
      })
    );

    await expect(
      adminApi.updateProfile({ display_name: "x".repeat(81) })
    ).rejects.toThrow(
      /HTTP 400/,
      /* message: "updateProfile must reject with an error containing 'HTTP 400' when the server returns 400" */
    );
  });

  it("rejects with an error containing 'HTTP 500' when server returns 500", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrorResponse(500)
    );

    await expect(
      adminApi.updateProfile({ display_name: "Valid Name" })
    ).rejects.toThrow(/HTTP 500/);
  });

  it("rejects with an error containing 'HTTP 401' when server returns 401", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrorResponse(401)
    );

    await expect(
      adminApi.updateProfile({ display_name: "Valid Name" })
    ).rejects.toThrow(/HTTP 401/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-1 / AC-PR-FE-1-F2 — changePassword rejects on 401 (wrong current password)
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-1 / AC-PR-FE-1-F2 — changePassword rejects on 401 wrong current password", () => {
  it("rejects with an error containing 'HTTP 401' when API returns 401", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrorResponse(401, {
        error: "UNAUTHORIZED",
        message: "COPY.admin.profile.wrongCurrentPassword",
      })
    );

    await expect(
      adminApi.changePassword({
        current_password: "WrongPass123!",
        new_password: "NewPass456!",
      })
    ).rejects.toThrow(
      /HTTP 401/,
      /* message: "changePassword must reject with 'HTTP 401' when the current_password is wrong (AC-PR-FE-1-F2)" */
    );
  });

  it("rejects with an error containing 'HTTP 400' when new_password is too short", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrorResponse(400, {
        error: "VALIDATION_ERROR",
        message: "COPY.admin.profile.newPasswordTooShort",
      })
    );

    await expect(
      adminApi.changePassword({
        current_password: "OldPass123!",
        new_password: "short",
      })
    ).rejects.toThrow(/HTTP 400/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-FE-1 — updateProfile and changePassword exports exist and are functions
// ─────────────────────────────────────────────────────────────────────────────

describe("SA-FE-1 / PR-FE-1 — New adminApi functions are exported and callable", () => {
  it("updateProfile is exported from adminApi as a function", () => {
    expect(typeof adminApi.updateProfile).toBe(
      "function",
      "adminApi.updateProfile must be exported as a function (AC-PR-FE-1-S1)"
    );
  });

  it("changePassword is exported from adminApi as a function", () => {
    expect(typeof adminApi.changePassword).toBe(
      "function",
      "adminApi.changePassword must be exported as a function (AC-PR-FE-1-S2)"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RM-FE-8 / AC-RM-FE-8-S1 — getAdminReports({ limit: 200, page: 1 }) URL serialisation
// ─────────────────────────────────────────────────────────────────────────────

describe("RM-FE-8 / AC-RM-FE-8-S1 — getAdminReports with limit=200 and page=1 serialises correctly", () => {
  it("includes limit=200 in the query string", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ data: [], pagination: { page: 1, limit: 200, total_count: 0, total_pages: 0 } })
    );

    await adminApi.getAdminReports({ limit: 200, page: 1 });

    const url = lastFetchUrl();
    expect(url).toContain(
      "limit=200",
      "getAdminReports({ limit: 200 }) must include 'limit=200' in the query string (AC-RM-FE-8-S1)"
    );
  });

  it("includes page=1 in the query string", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ data: [], pagination: { page: 1, limit: 200, total_count: 0, total_pages: 0 } })
    );

    await adminApi.getAdminReports({ limit: 200, page: 1 });

    const url = lastFetchUrl();
    expect(url).toContain(
      "page=1",
      "getAdminReports({ page: 1 }) must include 'page=1' in the query string (AC-RM-FE-8-S1)"
    );
  });

  it("includes credentials: 'include' for the map fetch (AC-RM-BE-1-S1 auth guard)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockOkResponse({ data: [], pagination: { page: 1, limit: 200, total_count: 0, total_pages: 0 } })
    );

    await adminApi.getAdminReports({ limit: 200, page: 1 });

    const opts = lastFetchOptions();
    expect(opts.credentials).toBe(
      "include",
      "getAdminReports must include credentials: 'include' so the admin JWT cookie is sent"
    );
  });
});
