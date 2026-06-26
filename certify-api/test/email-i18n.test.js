import { test } from "node:test";
import assert from "node:assert/strict";

import { otpEmail, passwordResetEmail } from "../src/services/email/authTemplates.js";
import { certificateEmail } from "../src/services/email/templates.js";
import { paymentReceiptEmail } from "../src/services/email/billingTemplates.js";
import { ticketAckUserEmail, newTicketAdminEmail } from "../src/services/email/supportTemplates.js";

// Product decision: all outgoing system emails are in English, regardless of
// the recipient's stored locale. These lock that behavior in.

test("account activation (OTP) email is English even for an Arabic recipient", () => {
  const otp = otpEmail({ userName: "سعد", code: "123456", locale: "ar" });
  assert.match(otp.html, /dir="ltr"/);
  assert.match(otp.subject, /verification code/);
  assert.ok(otp.html.includes("123456"));
});

test("password reset email is English", () => {
  const reset = passwordResetEmail({ userName: "أحمد", resetUrl: "https://x/y", locale: "ar" });
  assert.match(reset.html, /dir="ltr"/);
  assert.match(reset.subject, /Reset your password/);
});

test("certificate email is English; verify URL preserved", () => {
  const cert = certificateEmail({
    recipientName: "لانا", courseName: "Security 101", orgName: "Acme",
    verifyUrl: "https://v/abc", pdfUrl: null, locale: "ar",
  });
  assert.match(cert.html, /dir="ltr"/);
  assert.match(cert.subject, /Your certificate/);
  assert.ok(cert.html.includes("https://v/abc"));
});

test("billing receipt + support emails are English", () => {
  const billing = paymentReceiptEmail({
    userName: "A", planName: "Pro", amount: 29, currency: "USD",
    interval: "monthly", gateway: "Stripe", periodEnd: null, webUrl: "https://w", locale: "ar",
  });
  assert.match(billing.html, /dir="ltr"/);
  assert.match(billing.subject, /Welcome to the Pro plan/);

  const ack = ticketAckUserEmail({ userName: "أ", subject: "S", dashboardUrl: "https://w/d", locale: "ar" });
  assert.match(ack.subject, /We received your request/);

  const admin = newTicketAdminEmail({ subject: "S", requesterName: "X", requesterEmail: "x@y", adminUrl: "https://a" });
  assert.match(admin.subject, /New support ticket/);
});
