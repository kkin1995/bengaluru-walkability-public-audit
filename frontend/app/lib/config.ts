/**
 * Centralized runtime configuration.
 *
 * API_BASE_URL — client-side API base. Empty string means relative URLs
 * (/api/...) which nginx proxies to the backend regardless of what hostname
 * the browser is using (localhost, LAN IP, production domain).
 *
 * INTERNAL_API_URL — server-side only. Used by Next.js server components to
 * reach the backend via Docker internal networking. Never sent to the browser.
 * Set INTERNAL_API_URL=http://backend:3001 in docker-compose.yml environment.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ?? "http://localhost:3001";
