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

  if (config.adminEmail) {
    send(
      newTicketAdminEmail({ subject: ticket.subject, requesterName: name, requesterEmail: email, adminUrl: adminUrl() }),
      "new ticket → admin",
    );
  }

  if (ticket.userId && ticket.user?.email) {
    send(
      ticketAckUserEmail({ userName: ticket.user.name, subject: ticket.subject, dashboardUrl: dashboardUrl() }),
      "ack → user",
    );
  } else if (ticket.guestEmail) {
    send(
      ticketAckGuestEmail({ guestName: ticket.guestName, subject: ticket.subject, portalUrl: portalUrl(ticket.publicToken) }),
      "ack → guest",
    );
  }
}

/** The admin replied → notify the customer (user or guest). */
export function notifyAdminReply(ticket) {
  if (ticket.userId && ticket.user?.email) {
    send(
      adminReplyUserEmail({ userName: ticket.user.name, subject: ticket.subject, dashboardUrl: dashboardUrl() }),
      "admin reply → user",
    );
  } else if (ticket.guestEmail) {
    send(
      adminReplyGuestEmail({ guestName: ticket.guestName, subject: ticket.subject, portalUrl: portalUrl(ticket.publicToken) }),
      "admin reply → guest",
    );
  }
}

/** A customer replied → notify the admin inbox. */
export function notifyCustomerReply(ticket) {
  if (!config.adminEmail) return;
  const { name } = requesterLabel(ticket);
  send(
    customerReplyAdminEmail({ subject: ticket.subject, requesterName: name, adminUrl: adminUrl() }),
    "customer reply → admin",
  );
}
