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
