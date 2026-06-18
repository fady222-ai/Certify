import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for client-side lib logic (auth/token handling, API client) and
// pure component helpers. jsdom gives us window + localStorage; network is
// mocked per-test. The "@/..." alias mirrors tsconfig so tests can import the
// same way the app does.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
