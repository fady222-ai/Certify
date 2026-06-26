import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

import { otpEmail, passwordResetEmail } from "../src/services/email/authTemplates.js";
import { certificateEmail } from "../src/services/email/templates.js";
import { paymentReceiptEmail } from "../src/services/email/billingTemplates.js";
import { ticketAckUserEmail, newTicketAdminEmail } from "../src/services/email/supportTemplates.js";

// Outgoing emails honor the EMAIL_LOCALE override (read per-call):
//   unset / "en" → force English (the product default, even for "ar" recipients)
//   "ar"         → force Arabic
//   "auto"       → follow each recipient's own locale
const savedEnv = process.env.EMAIL_LOCALE;
afterEach(() => {
  if (savedEnv === undefined) delete process.env.EMAIL_LOCALE;
  else process.env.EMAIL_LOCALE = savedEnv;
});

test("default forces English for ALL emails, even Arabic recipients", () => {
  delete process.env.EMAIL_LOCALE; // default behavior
  const otp = otpEmail({ userName: "سعد", code: "123456", locale: "ar" });
  assert.match(otp.html, /dir="ltr"/);
  assert.match(otp.subject, /verification code/);
  assert.ok(otp.html.includes("123456"));

  const reset = passwordResetEmail({ userName: "أحمد", resetUrl: "https://x/y", locale: "ar" });
  assert.match(reset.html, /dir="ltr"/);
  assert.match(reset.subject, /Reset your password/);

  const cert = certificateEmail({
    recipientName: "لانا", courseName: "أمن", orgName: "أكمي",
    verifyUrl: "https://v/abc", pdfUrl: null, locale: "ar",
  });
  assert.match(cert.html, /dir="ltr"/);
  assert.match(cert.subject, /Your certificate/);

  const ack = ticketAckUserEmail({ userName: "أ", subject: "S", dashboardUrl: "https://w/d", locale: "ar" });
  assert.match(ack.subject, /We received your request/);
  const admin = newTicketAdminEmail({ subject: "S", requesterName: "X", requesterEmail: "x@y", adminUrl: "https://a" });
  assert.match(admin.subject, /New support ticket/);
});

test("EMAIL_LOCALE=en is explicit English", () => {
  process.env.EMAIL_LOCALE = "en";
  const billing = paymentReceiptEmail({
    userName: "A", planName: "Pro", amount: 29, currency: "USD",
    interval: "monthly", gateway: "Stripe", periodEnd: null, webUrl: "https://w", locale: "ar",
  });
  assert.match(billing.html, /dir="ltr"/);
  assert.match(billing.subject, /Welcome to the Pro plan/);
});

test("EMAIL_LOCALE=ar forces Arabic even for English recipients", () => {
  process.env.EMAIL_LOCALE = "ar";
  const otp = otpEmail({ userName: "Saad", code: "999", locale: "en" });
  assert.match(otp.html, /dir="rtl"/);
  assert.match(otp.subject, /رمز التحقق/);
});

test("EMAIL_LOCALE=auto follows the recipient locale", () => {
  process.env.EMAIL_LOCALE = "auto";
  const en = otpEmail({ userName: "Saad", code: "1", locale: "en" });
  assert.match(en.html, /dir="ltr"/);
  assert.match(en.subject, /verification code/);

  const ar = otpEmail({ userName: "سعد", code: "1", locale: "ar" });
  assert.match(ar.html, /dir="rtl"/);
  assert.match(ar.subject, /رمز التحقق/);

  const unknown = otpEmail({ userName: "X", code: "1", locale: "fr" });
  assert.match(unknown.html, /dir="rtl"/); // unknown → Arabic fallback
});
