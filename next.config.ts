import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // Private evidence is runtime-local or fetched under owner RLS, never bundled.
  outputFileTracingExcludes: {"/**": ["./.local/**/*", "./.env*"]},
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
