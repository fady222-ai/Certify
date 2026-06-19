import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subdirectory alongside other projects; pin the
  // Turbopack root so Next doesn't infer the wrong workspace from sibling lockfiles.
  turbopack: {
    root: __dirname,
  },
  // Self-contained server output for container/Railway deployments.
  output: "standalone",
  async headers() {
    return [
      {
        // The guest ticket link carries an unguessable capability token in the
        // URL; suppress the Referer so it can't leak to third-party origins.
        source: "/support/ticket/:token*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
