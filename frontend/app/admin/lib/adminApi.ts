/**
 * adminApi.ts — Typed API client for the admin dashboard.
 *
 * Contracts (from AC-API-1, AC-API-2, AC-API-3):
 *   - Every fetch call must include `credentials: 'include'`  (R-API-1)
 *   - Any non-2xx HTTP response must cause the returned Promise to reject
 *     with an error that includes the HTTP status code  (R-API-2)
 *   - All 11 named exports must be present and callable  (R-API-3)
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  role: "admin" | "reviewer";
  display_name: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface UpdateProfilePayload {
  display_name?: string | null;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface AdminReport {
  id: string;
  created_at: string;
  updated_at: string;
  image_path: string;
  image_url: string;
  latitude: number;
  longitude: number;
  category: string;
  severity: string;
  description: string | null;
  submitter_name: string | null;
  submitter_contact: string | null;
  status: string;
  location_source: string;
}

export interface AdminReportListResponse {
  data: AdminReport[];
  pagination: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
  };
}

export interface AdminStats {
  total_reports: number;
  by_status: { submitted: number; under_review: number; resolved: number };
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
}

export interface AdminReportFilters {
  page?: number;
  limit?: number;
  category?: string;
  status?: string;
  severity?: string;
  date_from?: string;
  date_to?: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role: "admin" | "reviewer";
  display_name?: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  // 204 No Content — nothing to parse
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string
): Promise<AdminUser> {
  return apiFetch<AdminUser>(`${BASE}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  return apiFetch<void>(`${BASE}/api/admin/auth/logout`, {
    method: "POST",
  });
}

export async function getMe(): Promise<AdminUser> {
  return apiFetch<AdminUser>(`${BASE}/api/admin/auth/me`);
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function getAdminReports(
  filters?: AdminReportFilters
): Promise<AdminReportListResponse> {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.page !== undefined) params.set("page", String(filters.page));
    if (filters.limit !== undefined) params.set("limit", String(filters.limit));
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
  }
  const qs = params.toString();
  const url = `${BASE}/api/admin/reports${qs ? `?${qs}` : ""}`;
  return apiFetch<AdminReportListResponse>(url);
}

export async function getAdminReport(id: string): Promise<AdminReport> {
  return apiFetch<AdminReport>(`${BASE}/api/admin/reports/${id}`);
}

export async function updateReportStatus(
  id: string,
  status: string,
  note?: string
): Promise<AdminReport> {
  const body: Record<string, unknown> = { status };
  if (note !== undefined) {
    body.note = note;
  }
  return apiFetch<AdminReport>(`${BASE}/api/admin/reports/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteReport(id: string): Promise<void> {
  return apiFetch<void>(`${BASE}/api/admin/reports/${id}`, {
    method: "DELETE",
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>(`${BASE}/api/admin/stats`);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>(`${BASE}/api/admin/users`);
}

export async function createUser(data: CreateUserPayload): Promise<AdminUser> {
  return apiFetch<AdminUser>(`${BASE}/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deactivateUser(id: string): Promise<void> {
  return apiFetch<void>(`${BASE}/api/admin/users/${id}`, {
    method: "DELETE",
  });
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function updateProfile(data: UpdateProfilePayload): Promise<AdminUser> {
  return apiFetch<AdminUser>(`${BASE}/api/admin/auth/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function changePassword(data: ChangePasswordPayload): Promise<void> {
  await apiFetch<void>(`${BASE}/api/admin/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
