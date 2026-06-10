import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subdirectory alongside other projects; pin the
  // Turbopack root so Next doesn't infer the wrong workspace from sibling lockfiles.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
