import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(__dirname, "package.json"), "utf8")
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  // "standalone" is required for Docker/self-hosted builds.
  // Vercel handles its own output format — do not set standalone there.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  eslint: {
    // ESLint runs as a separate CI step; don't block production builds
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "backend" },
      { protocol: "https", hostname: "staging.nammadaari.com" },
    ],
  },
  // FIX-02/03 (D-07): Permanent redirects for deprecated routes.
  // /report and /reports are replaced by the home page flow.
  // permanent: true emits HTTP 308 (Next.js App Router), intercepting before route rendering.
  // T-05-07: destinations are hardcoded to "/" — no open-redirect surface.
  async redirects() {
    return [
      {
        source: "/report",
        destination: "/",
        permanent: true,
      },
      {
        source: "/reports",
        destination: "/",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    // Proxy /uploads/* to the backend so uploaded images load correctly when
    // the frontend and backend are on different origins (Vercel + Cloudflare
    // Tunnel split-deploy). Without this, relative /uploads/... URLs resolve
    // to the Vercel domain which has no uploads route (404).
    // Guard: skip if INTERNAL_API_URL is unset to avoid self-referencing rewrites.
    const backend = process.env.INTERNAL_API_URL;
    if (!backend) return [];
    return [
      {
        source: "/uploads/:path*",
        destination: `${backend}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
