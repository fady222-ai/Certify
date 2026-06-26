// Best-effort notifications for the support ticket system. Mirrors
// certificateMailer.js / billingMailer.js: each helper picks the right template
// based on whether the ticket belongs to an authenticated user or a guest, then
// fires the email without blocking the request (errors only logged).

import { config } from "../config/index.js";
import { sendEmail, logMailFailure } from "./email/index.js";
import {
  newTicketAdminEmail,
  ticketAckUserEmail,
  ticketAckGuestEmail,
  adminReplyUserEmail,
  adminReplyGuestEmail,
  customerReplyAdminEmail,
} from "./email/supportTemplates.js";

const base = () => config.verifyBaseUrl.replace(/\/$/, "");
const portalUrl = (token) => `${base()}/support/ticket/${token}`;
const dashboardUrl = () => `${base()}/dashboard/support`;
const adminUrl = () => `${base()}/admin/support`;

function send(msg, context) {
  sendEmail(msg).catch(logMailFailure(`support: ${context}`));
}

// In-memory safety valves (best-effort, per process — like the gatewayConfig
// cache, they don't span multiple API instances). They bound abuse that survives
// IP-based rate limits (e.g. IP rotation): a hard ceiling on admin notifications
// and a per-recipient ceiling on guest acks (blunts targeted mail-bombing).
const ADMIN_MAX = 20;
const ADMIN_WINDOW_MS = 10 * 60 * 1000;
const RECIPIENT_MAX = 3;
const RECIPIENT_WINDOW_MS = 60 * 60 * 1000;
const adminHits = [];
const recipientHits = new Map();

function allowAdminNotice() {
  const now = Date.now();
  while (adminHits.length && now - adminHits[0] > ADMIN_WINDOW_MS) adminHits.shift();
  if (adminHits.length >= ADMIN_MAX) return false;
  adminHits.push(now);
  return true;
}

function allowRecipient(email) {
  if (!email) return false;
  const now = Date.now();
  const hits = (recipientHits.get(email) ?? []).filter((t) => now - t < RECIPIENT_WINDOW_MS);
  if (hits.length >= RECIPIENT_MAX) {
    recipientHits.set(email, hits);
    return false;
  }
  hits.push(now);
  recipientHits.set(email, hits);
  // Opportunistic cleanup so the map can't grow without bound.
  if (recipientHits.size > 5000) {
    for (const [k, v] of recipientHits) if (!v.some((t) => now - t < RECIPIENT_WINDOW_MS)) recipientHits.delete(k);
  }
  return true;
}

/** Customer name/email for admin-facing notifications. */
function requesterLabel(ticket) {
  return {
    name: ticket.user?.name ?? ticket.guestName ?? null,
    email: ticket.user?.email ?? ticket.guestEmail ?? null,
  };
}

/** A new ticket was opened → ack the customer + notify the admin inbox. */
export function notifyNewTicket(ticket) {
  const { name, email } = requesterLabel(ticket);

  if (config.adminEmail && allowAdminNotice()) {
    send(
      newTicketAdminEmail({ subject: ticket.subject, requesterName: name, requesterEmail: email, adminUrl: adminUrl() }),
      "new ticket → admin",
    );
  }

  if (ticket.userId && ticket.user?.email) {
    send(
      ticketAckUserEmail({ userName: ticket.user.name, subject: ticket.subject, dashboardUrl: dashboardUrl(), locale: ticket.user.locale }),
      "ack → user",
    );
  } else if (ticket.guestEmail && ticket.rawToken && allowRecipient(ticket.guestEmail)) {
    // Guest ack goes to an attacker-choosable address, so it carries no
    // attacker-controlled free text (no name/subject) and is rate-capped per
    // recipient — it can't be used as a phishing/mail-bomb relay.
    send(
      ticketAckGuestEmail({ portalUrl: portalUrl(ticket.rawToken) }),
      "ack → guest",
    );
  }
}

/** The admin replied → notify the customer (user or guest). */
export function notifyAdminReply(ticket) {
  if (ticket.userId && ticket.user?.email) {
    send(
      adminReplyUserEmail({ userName: ticket.user.name, subject: ticket.subject, dashboardUrl: dashboardUrl(), locale: ticket.user.locale }),
      "admin reply → user",
    );
  } else if (ticket.guestEmail && ticket.rawToken) {
    send(
      adminReplyGuestEmail({ guestName: ticket.guestName, subject: ticket.subject, portalUrl: portalUrl(ticket.rawToken) }),
      "admin reply → guest",
    );
  }
}

/** A customer replied → notify the admin inbox. */
export function notifyCustomerReply(ticket) {
  if (!config.adminEmail || !allowAdminNotice()) return;
  const { name } = requesterLabel(ticket);
  send(
    customerReplyAdminEmail({ subject: ticket.subject, requesterName: name, adminUrl: adminUrl() }),
    "customer reply → admin",
  );
}
