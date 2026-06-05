/**
 * Centralized runtime configuration.
 *
 * API_BASE_URL — client-side API base for PUBLIC endpoints (report
 * submission, map). On staging this is the Railway backend URL
 * (e.g. https://walkability-api.up.railway.app). In Docker (nginx proxy)
 * this is "" (empty string = relative URLs).
 *
 * ADMIN_API_BASE_URL — client-side API base for ADMIN endpoints. Always ""
 * (empty string = relative URLs). On staging, Next.js rewrites in
 * next.config.mjs proxy /api/admin/* to the Railway backend, ensuring
 * the auth cookie is set on the Vercel domain.
 *
 * INTERNAL_API_URL — server-side only. Used by Next.js server components
 * (admin/layout.tsx) and Next.js rewrites to reach the backend. Never
 * sent to the browser.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const ADMIN_API_BASE_URL = "";
export const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ?? "http://localhost:3001";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
// FIX-11 (D-27/D-29): Build hash baked at CI build time via NEXT_PUBLIC_BUILD_HASH env var.
// Injected by the Vercel build command (NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD)).
// Defaults to "0000000" in local dev where the env var is absent.
export const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_HASH ?? "0000000";
