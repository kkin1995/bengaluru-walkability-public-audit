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
};

export default nextConfig;
