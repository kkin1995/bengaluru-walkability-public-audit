/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" is required for Docker/self-hosted builds.
  // Vercel handles its own output format — do not set standalone there.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  eslint: {
    // ESLint runs as a separate CI step; don't block production builds
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    // Proxy admin API routes through Vercel so the backend's Set-Cookie
    // header is scoped to the Vercel domain. This lets Next.js middleware
    // read the admin_token cookie for auth guards.
    //
    // CAUTION: Do NOT proxy POST /api/reports — Vercel has a 4.5 MB body
    // limit; the app allows 20 MB photo uploads. Public submission calls
    // the Railway backend directly via NEXT_PUBLIC_API_URL.
    const backendUrl = process.env.INTERNAL_API_URL || "http://localhost:3001";
    return [
      {
        source: "/api/admin/:path*",
        destination: `${backendUrl}/api/admin/:path*`,
      },
    ];
  },
};

export default nextConfig;
