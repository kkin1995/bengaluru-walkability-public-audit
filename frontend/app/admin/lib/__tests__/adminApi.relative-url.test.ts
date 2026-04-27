/**
 * Regression test for the admin auth same-origin cookie fix.
 *
 * adminApi must always build RELATIVE /api/admin/* URLs so that:
 *   1. Next.js rewrites in next.config.mjs proxy them to INTERNAL_API_URL
 *   2. The backend's Set-Cookie header is scoped to the Vercel domain
 *      (not the Railway domain), making the HttpOnly admin_token cookie
 *      visible to Next.js middleware and server components.
 *
 * If ADMIN_API_BASE_URL is ever changed from "" to an absolute URL,
 * these tests fail and the cookie regression returns.
 */

import { login, getMe, getAdminReports } from "../adminApi";

describe("adminApi: same-origin relative URLs", () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("login() posts to /api/admin/auth/login (relative — no absolute origin)", async () => {
    await login("a@b.c", "pw");
    const url = fetchMock.mock.calls[0][0] as string;
    // Relative URL ensures the Next.js rewrite proxies it to INTERNAL_API_URL
    // and the HttpOnly cookie is scoped to the Vercel domain (Phase 02.2 invariant)
    expect(url.startsWith("/api/admin/")).toBe(true);
    expect(url).not.toMatch(/^https?:\/\//);
    expect(url).toBe("/api/admin/auth/login");
  });

  it("getMe() requests /api/admin/auth/me (relative)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
    await getMe();
    const url = fetchMock.mock.calls[0][0] as string;
    // Relative URL ensures the same-origin cookie is attached by the browser
    // when the server component re-fetches after router.refresh()
    expect(url.startsWith("/api/admin/")).toBe(true);
    expect(url).not.toMatch(/^https?:\/\//);
    expect(url).toBe("/api/admin/auth/me");
  });

  it("getAdminReports() builds /api/admin/reports?... relative URL", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [], pagination: { page: 1, limit: 20, total_count: 0, total_pages: 1 } }),
    } as Response);
    await getAdminReports({ page: 1, limit: 20 });
    const url = fetchMock.mock.calls[0][0] as string;
    // Relative URL guards the invariant established in Phase 02.2:
    // all admin API calls go through Next.js rewrites, never to Railway directly
    expect(url.startsWith("/api/admin/reports")).toBe(true);
    expect(url).not.toMatch(/^https?:\/\//);
  });
});
