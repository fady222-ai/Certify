import { test } from "node:test";
import assert from "node:assert/strict";

import { otpEmail, passwordResetEmail } from "../src/services/email/authTemplates.js";
import { certificateEmail } from "../src/services/email/templates.js";
import { paymentReceiptEmail } from "../src/services/email/billingTemplates.js";
import { ticketAckUserEmail } from "../src/services/email/supportTemplates.js";

// Bilingual transactional emails: the recipient's locale selects the language,
// and anything other than "en" falls back to Arabic (the default).

test("otpEmail: Arabic by default, English when locale=en", () => {
  const ar = otpEmail({ userName: "سعد", code: "123456" });
  assert.match(ar.html, /dir="rtl"/);
  assert.match(ar.subject, /رمز التحقق/);
  assert.match(ar.text, /رمز التحقق الخاص بك/);

  const en = otpEmail({ userName: "Saad", code: "123456", locale: "en" });
  assert.match(en.html, /dir="ltr"/);
  assert.match(en.subject, /verification code/);
  assert.match(en.text, /Your verification code/);
  // The code itself is identical regardless of language.
  assert.ok(ar.html.includes("123456") && en.html.includes("123456"));
});

test("passwordResetEmail: locale switches language + direction", () => {
  const en = passwordResetEmail({ userName: "A", resetUrl: "https://x/y", locale: "en" });
  assert.match(en.html, /dir="ltr"/);
  assert.match(en.subject, /Reset your password/);

  const ar = passwordResetEmail({ userName: "أ", resetUrl: "https://x/y" });
  assert.match(ar.html, /dir="rtl"/);
  assert.match(ar.subject, /استعادة كلمة المرور/);
});

test("certificateEmail: follows the academy locale; verify URL always present", () => {
  const en = certificateEmail({
    recipientName: "Lana", courseName: "Security 101", orgName: "Acme",
    verifyUrl: "https://v/abc", pdfUrl: null, locale: "en",
  });
  assert.match(en.html, /dir="ltr"/);
  assert.match(en.subject, /Your certificate in "Security 101"/);
  assert.ok(en.html.includes("https://v/abc"));

  const ar = certificateEmail({
    recipientName: "لانا", courseName: "أمن", orgName: "أكمي",
    verifyUrl: "https://v/abc", pdfUrl: null,
  });
  assert.match(ar.html, /dir="rtl"/);
  assert.match(ar.subject, /شهادتك في/);
});

test("unknown locale falls back to Arabic", () => {
  const fr = otpEmail({ userName: "X", code: "000000", locale: "fr" });
  assert.match(fr.html, /dir="rtl"/);
  assert.match(fr.subject, /رمز التحقق/);
});

test("billing receipt + support ack honor locale", () => {
  const en = paymentReceiptEmail({
    userName: "A", planName: "Pro", amount: 29, currency: "USD",
    interval: "monthly", gateway: "Stripe", periodEnd: null, webUrl: "https://w", locale: "en",
  });
  assert.match(en.subject, /Welcome to the Pro plan/);
  assert.match(en.html, /dir="ltr"/);

  const ackEn = ticketAckUserEmail({ userName: "A", subject: "Hi", dashboardUrl: "https://w/d", locale: "en" });
  assert.match(ackEn.subject, /We received your request/);
  const ackAr = ticketAckUserEmail({ userName: "أ", subject: "مرحبا", dashboardUrl: "https://w/d" });
  assert.match(ackAr.subject, /استلمنا طلبك/);
});
