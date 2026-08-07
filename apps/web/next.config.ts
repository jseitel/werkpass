import type { NextConfig } from "next";

const allowedDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Deploys as a self-contained Node server (no Vercel-specific runtime) so
  // the same Docker image runs on Hetzner, another cloud, or on-prem.
  output: "standalone",
  allowedDevOrigins,
  transpilePackages: [
    "@werkpass/ui",
    "@werkpass/core",
    "@werkpass/auth",
    "@werkpass/db",
  ],
};

export default nextConfig;
