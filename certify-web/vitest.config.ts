import { defineConfig } from "vitest/config";

// Unit tests for client-side lib logic (auth/token handling, API client).
// jsdom gives us window + localStorage; network is mocked per-test.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
