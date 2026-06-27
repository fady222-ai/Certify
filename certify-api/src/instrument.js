// Sentry initialization. Imported FIRST in server.js (before express) so the
// SDK's auto-instrumentation can hook HTTP/Express. A complete no-op unless
// SENTRY_DSN is set, so local/dev and unconfigured deploys are unaffected.
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    // Conservative defaults — error monitoring only (no perf sampling cost
    // unless explicitly turned up via env).
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
  });
  console.log("[sentry] error monitoring enabled");
}

export { Sentry };
