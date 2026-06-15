import { config } from "../../config/index.js";

/**
 * Swappable email sender.
 *   - If RESEND_API_KEY is set → sends via the Resend HTTP API.
 *   - Otherwise → logs the message to the console (dev transport).
 *
 * Returns { ok, id?, transport, error? }. Never throws — callers treat email
 * as best-effort so issuance never fails because of a mail problem.
 *
 * @param {object} msg
 * @param {string} msg.to
 * @param {string} msg.subject
 * @param {string} msg.html
 * @param {string} [msg.text]
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!config.email.enabled) {
    return { ok: false, transport: "disabled" };
  }
  if (!to) {
    return { ok: false, transport: "none", error: "no recipient" };
  }

  if (config.email.resendApiKey) {
    return sendViaResend({ to, subject, html, text });
  }
  return sendViaConsole({ to, subject });
}

async function sendViaResend({ to, subject, html, text }) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.email.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: config.email.from, to, subject, html, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[email] Resend error:", data);
      return { ok: false, transport: "resend", error: data?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, transport: "resend", id: data?.id };
  } catch (err) {
    console.error("[email] Resend request failed:", err.message);
    return { ok: false, transport: "resend", error: err.message };
  }
}

/**
 * Returns a `.catch` handler for best-effort (fire-and-forget) mail sends.
 * Email is intentionally non-blocking — issuance/billing must not fail if mail
 * does — but a thrown error (e.g. a missing recipient record) should still be
 * visible in the logs rather than silently swallowed by `.catch(() => {})`.
 */
export function logMailFailure(context) {
  return (err) => console.warn(`[email] ${context} failed:`, err?.message ?? err);
}

function sendViaConsole({ to, subject }) {
  console.log(`\n📧 [email:console] → ${to}\n   subject: ${subject}\n   (set RESEND_API_KEY to send for real)\n`);
  return { ok: true, transport: "console" };
}
