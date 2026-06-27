import * as Sentry from "@sentry/node";
import { config } from "../config/index.js";

// Basic throttle so a burst of errors can't spam the alert channel.
let lastSent = 0;
const MIN_INTERVAL_MS = 5000;

/**
 * Log an error server-side and, when ERROR_WEBHOOK_URL is configured, post a
 * short summary to it (Slack/Discord-compatible `{ text }` payload). Never
 * throws and never blocks the request path.
 *
 * @param {unknown} err
 * @param {{ where?: string, method?: string, path?: string }} [context]
 */
export function reportError(err, context = {}) {
  try {
    console.error(`[error]${context.where ? " " + context.where : ""}`, err);
  } catch {
    /* logging must never throw */
  }

  // Full error monitoring via Sentry (no-op unless SENTRY_DSN is set). Not
  // throttled — Sentry does its own dedupe/grouping and we want every event.
  if (config.sentryDsn) {
    try {
      Sentry.captureException(err, { extra: context });
    } catch {
      /* monitoring must never throw */
    }
  }

  const url = config.errorWebhookUrl;
  if (!url) return;

  const now = Date.now();
  if (now - lastSent < MIN_INTERVAL_MS) return; // throttle
  lastSent = now;

  const detail = err?.stack || err?.message || String(err);
  const where = [context.where, context.method, context.path].filter(Boolean).join(" ");
  const text = `🚨 Certify error${where ? ` — ${where}` : ""}\n${String(detail).slice(0, 1500)}`;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}
