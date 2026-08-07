import type { NextConfig } from "next";

const allowedDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Uploads/downloads talk to the S3-compatible object store directly from the
// browser (see packages/core/src/storage.ts), so its origin must be allowed
// in connect-src or the presigned PUT upload breaks under a strict CSP.
function s3Origin(): string | null {
  try {
    return process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).origin : null;
  } catch {
    return null;
  }
}

const connectSrc = ["'self'", s3Origin()].filter(Boolean).join(" ");

// React/Turbopack's dev-mode debugging (call-stack reconstruction, HMR) needs
// eval(); production never uses it, so keep 'unsafe-eval' out of that build.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = ["'self'", "'unsafe-inline'", isDev && "'unsafe-eval'"]
  .filter(Boolean)
  .join(" ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
