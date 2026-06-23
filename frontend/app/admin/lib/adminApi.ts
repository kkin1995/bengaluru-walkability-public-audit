/**
 * adminApi.ts — Typed API client for the admin dashboard.
 *
 * Contracts (from AC-API-1, AC-API-2, AC-API-3):
 *   - Every fetch call must include `credentials: 'include'`  (R-API-1)
 *   - Any non-2xx HTTP response must cause the returned Promise to reject
 *     with an error that includes the HTTP status code  (R-API-2)
 *   - All 11 named exports must be present and callable  (R-API-3)
 */

import type { FeatureCollection } from "geojson";

import { ADMIN_API_BASE_URL as BASE, API_BASE_URL } from "@/app/lib/config";

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
  // WR-04: org_id marked optional — Rust AdminUserResponse never serializes this field;
  // the value is always undefined in the browser (not null). Marked optional so existing
  // call sites do not break. Re-add as required when org_id: Option<Uuid> is added to
  // AdminUserResponse on the backend.
  org_id?: string | null;
}

export interface UpdateProfilePayload {
  display_name?: string | null;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

// Phase 03.2 (D-08): Status history entry — matches backend status_history JSON shape exactly
export interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  note: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
}

// Phase 03 (D-21, D-42, D-43, D-44): Ward hierarchy from wards table migration
export interface WardHierarchy {
  ward_name: string | null;
  ward_number: number | null;
  corporation: string | null;
  zone_name: string | null;
  ro_division: string | null;
  aro_sub_division: string | null;
  assembly_constituency: string | null;
  assembly_constituency_no: number | null;
  parliamentary_constituency: string | null;
  mla_name: string | null;
  mp_name: string | null;
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
  ward_name: string | null;
  // Phase 03 (WARNING-02): Corporation from ward JOIN — populated by backend list_admin_reports query
  corporation: string | null;
  // Phase 03 (D-13, D-14, D-15): Resolution evidence fields
  resolution_photo_url: string | null;
  resolution_notes: string | null;
  // Phase 03 (D-08, D-09): Org assignment
  assigned_org_id: string | null;
  assigned_org_name: string | null;
  // Phase 03 (D-21, D-23): Ward hierarchy for bureaucratic + elected chain display
  ward_hierarchy?: WardHierarchy | null;
  // ABUSE-06: Deduplication signals (Phase 02-02)
  duplicate_count?: number;
  duplicate_of_id?: string | null;
  duplicate_confidence?: string | null;
  // Phase 03.2 (D-07, D-08): Audit trail — status change history from backend
  status_history?: StatusHistoryEntry[];
}

export interface Organization {
  id: string;
  name: string;
  org_type: "gba" | "corporation" | "ward_office";
  parent_id: string | null;
  created_at: string;
  updated_at: string;
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
  // FIX-08 (D-20/D-21): Reports submitted today — date-based (UTC), independent of status transitions.
  today_count: number;
  // Phase 03 (D-03): 6-value status enum shape
  by_status: { open: number; acknowledged: number; assigned: number; in_progress: number; resolved: number; closed: number };
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
  // Phase 07-04 (D-04): Geographic scope filters
  ward_id?: string;
  corporation_id?: string;
}

// ─── Phase 07-04: Corporation + Ward filter option shapes ──────────────────────

export interface CorporationOption {
  id: string;
  name: string;
}

export interface WardOption {
  id: string;
  ward_name: string;
  ward_number: number;
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
    // WR-02: read the response body so backend 400/409 error details reach the UI.
    let detail = "";
    try { detail = await res.text(); } catch { /* ignore read errors */ }
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
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
    if (filters.ward_id) params.set("ward_id", filters.ward_id);
    if (filters.corporation_id) params.set("corporation_id", filters.corporation_id);
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

/// Fetch all duplicate reports linked to the given original report ID.
/// Called by the admin frontend expandable row on expand.
export async function getDuplicatesForReport(
  originalId: string
): Promise<AdminReport[]> {
  const data = await apiFetch<AdminReportListResponse>(
    `${BASE}/api/admin/reports?duplicate_of_id=${encodeURIComponent(originalId)}`
  );
  return data.data ?? [];
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>(`${BASE}/api/admin/stats`);
}

/// Per-day report count returned by GET /api/admin/stats/intake?days=N (BUG-03.2-A).
/// `day` is an ISO date string "YYYY-MM-DD" (UTC).
/// Only days with at least one submission appear — frontend zero-fills gaps.
export interface IntakeDayCount {
  day: string;
  count: number;
}

/// Fetch per-day report counts for the last `days` calendar days.
///
/// Routes through apiFetch so credentials: "include" is applied automatically
/// (shared pattern — do not call fetch() directly here).
export async function getIntakeStats(days: number): Promise<IntakeDayCount[]> {
  return apiFetch<IntakeDayCount[]>(`${BASE}/api/admin/stats/intake?days=${days}`);
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

// ─── Phase 03: Resolution + Org assignment ────────────────────────────────────

/**
 * Submit resolution evidence for a report (WFLOW-04, WFLOW-05).
 * Uses raw fetch (not apiFetch) because we must NOT set Content-Type manually —
 * the browser sets multipart/form-data boundary automatically (Pitfall 7 in research).
 * D-13: After-photo is mandatory; D-15: notes are optional.
 */
export async function resolveReport(
  id: string,
  status: "resolved" | "closed",
  photo: File,
  notes?: string
): Promise<AdminReport> {
  const form = new FormData();
  form.append("status", status);
  form.append("resolution_photo", photo);
  if (notes) form.append("resolution_notes", notes);
  const res = await fetch(`${BASE}/api/admin/reports/${id}/resolve`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Assign a report to an organisation (WFLOW-03, D-09).
 * Auto-advances status to "assigned" on the backend.
 */
export async function assignReportOrg(
  id: string,
  orgId: string
): Promise<AdminReport> {
  return apiFetch<AdminReport>(`${BASE}/api/admin/reports/${id}/assign-org`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ org_id: orgId }),
  });
}

// ─── Organizations ─────────────────────────────────────────────────────────────

export async function listOrganizations(): Promise<Organization[]> {
  return apiFetch<Organization[]>(`${BASE}/api/admin/organizations`, {
    method: "GET",
  });
}

export async function assignUserOrg(
  userId: string,
  orgId: string | null
): Promise<void> {
  await apiFetch<void>(`${BASE}/api/admin/users/${userId}/org`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ org_id: orgId }),
  });
}

// ─── Phase 04-01: Streaming export downloads (EXPORT-01, EXPORT-02) ──────────

/**
 * Download a CSV export of reports filtered by the current filter state.
 *
 * Calls GET /api/admin/reports/export/csv with filter query params.
 * Uses credentials: "include" so the admin session cookie is sent.
 * Returns the response body as a Blob for Blob URL download.
 *
 * Security: filter params are forwarded to the backend which binds them
 * via build_export_where_clause — no client-side SQL construction.
 */
export async function downloadCsvExport(
  filters?: AdminReportFilters
): Promise<Blob> {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
  }
  const qs = params.toString();
  const url = `${BASE}/api/admin/reports/export/csv${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

/**
 * Download a GeoJSON export of reports filtered by the current filter state.
 *
 * Calls GET /api/admin/reports/export/geojson with filter query params.
 * Uses credentials: "include" so the admin session cookie is sent.
 * Returns the response body as a Blob for Blob URL download.
 */
export async function downloadGeoJsonExport(
  filters?: AdminReportFilters
): Promise<Blob> {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
  }
  const qs = params.toString();
  const url = `${BASE}/api/admin/reports/export/geojson${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

// ─── Phase 04-03: Admin analytics (ANALYTICS-02/03/04/05) ────────────────────

export interface WardAnalytics {
  ward_name: string;
  ward_number: number;
  unresolved_count: number;
  total_count: number;
}

export interface CorporationAnalytics {
  corporation: string;
  total_reports: number;
  resolved_count: number;
  resolution_rate_pct: number | null;
}

export interface TrendDataPoint {
  week_start: string; // "YYYY-MM-DD"
  category: string;
  count: number;
}

export async function getWardAnalytics(): Promise<WardAnalytics[]> {
  const data = await apiFetch<{ data: WardAnalytics[] }>(`${BASE}/api/admin/analytics/wards`);
  return data.data;
}

export async function getCorporationAnalytics(): Promise<CorporationAnalytics[]> {
  const data = await apiFetch<{ data: CorporationAnalytics[] }>(`${BASE}/api/admin/analytics/corporations`);
  return data.data;
}

export async function getTrendData(category?: string): Promise<TrendDataPoint[]> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  const qs = params.toString();
  const data = await apiFetch<{ data: TrendDataPoint[] }>(`${BASE}/api/admin/analytics/trend${qs ? `?${qs}` : ""}`);
  return data.data;
}

export async function getWardBoundaries(): Promise<FeatureCollection> {
  // Phase 07-02: Updated to renamed admin path (T-07-05 — stays auth-gated via admin BASE/proxy).
  // The public ward boundary endpoint is GET /api/wards/boundaries (no auth) — the admin
  // choropleth uses this authenticated admin-only version to include unresolved_count.
  return apiFetch<FeatureCollection>(`${BASE}/api/admin/wards/boundaries`);
}

// ── Public stats (ANALYTICS-01) ───────────────────────────────────────────────

export interface PublicStats {
  total_reports: number;
  resolved_count: number;
  top_categories: Array<{ category: string; cnt: number }> | null;
}

/**
 * Fetch aggregate stats from the public /api/stats endpoint.
 * No credentials required — this is a public unauthenticated endpoint.
 */
export async function getPublicStats(): Promise<PublicStats> {
  const res = await fetch(`${API_BASE_URL}/api/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Phase 07-04: Corporation + Ward filter options (TRIAGE-01, D-03) ────────

/**
 * Fetch the list of corporations available for the filter bar.
 * Admin-gated — proxied through /api/admin/corporations (Plan 01 endpoint).
 */
export async function getAdminCorporations(): Promise<CorporationOption[]> {
  return apiFetch<CorporationOption[]>(`${BASE}/api/admin/corporations`);
}

/**
 * Fetch the list of wards, optionally narrowed to a specific corporation.
 * Admin-gated — proxied through /api/admin/wards (Plan 01 endpoint).
 * When corpId is provided, appends ?corp_id=<corpId> to narrow results (D-02).
 */
export async function getAdminWards(corpId?: string): Promise<WardOption[]> {
  const qs = corpId ? `?corp_id=${encodeURIComponent(corpId)}` : "";
  return apiFetch<WardOption[]>(`${BASE}/api/admin/wards${qs}`);
}
