import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";
import { sendEmail } from "./email/index.js";
import {
  paymentReceiptEmail,
  renewalReminderEmail,
  paymentFailedEmail,
} from "./email/billingTemplates.js";

const GATEWAY_AR = { stripe: "Stripe", tap: "Tap Payments", paymob: "Paymob" };

async function ownerOf(orgId) {
  return prisma.organization.findUnique({
    where: { id: orgId },
    select: { owner: { select: { name: true, email: true, locale: true } } },
  });
}

/**
 * Send a payment receipt (first activation) or renewal confirmation.
 * Fire-and-forget — never throws.
 */
export async function sendPaymentReceipt(orgId, plan, sub, { isRenewal = false } = {}) {
  try {
    const org = await ownerOf(orgId);
    if (!org?.owner?.email) return;
    const msg = paymentReceiptEmail({
      userName: org.owner.name,
      planName: plan.name,
      amount: sub.amount ?? 0,
      currency: sub.currency ?? "USD",
      interval: sub.interval,
      gateway: GATEWAY_AR[sub.gateway] ?? sub.gateway,
      periodEnd: sub.currentPeriodEnd,
      webUrl: config.verifyBaseUrl,
      isRenewal,
      locale: org.owner.locale,
    });
    await sendEmail({ to: org.owner.email, ...msg });
  } catch (err) {
    console.error("[billing-mail] receipt:", err.message);
  }
}

/**
 * Send a reminder 3 days before expiry to wallet-based subscribers who must renew manually.
 * Fire-and-forget — never throws.
 */
export async function sendRenewalReminder(orgId, plan, sub, daysLeft) {
  try {
    const org = await ownerOf(orgId);
    if (!org?.owner?.email) return;
    const msg = renewalReminderEmail({
      userName: org.owner.name,
      planName: plan.name,
      daysLeft,
      periodEnd: sub.currentPeriodEnd,
      webUrl: config.verifyBaseUrl,
      locale: org.owner.locale,
    });
    await sendEmail({ to: org.owner.email, ...msg });
  } catch (err) {
    console.error("[billing-mail] reminder:", err.message);
  }
}

/**
 * Notify org owner that an auto-renewal charge failed.
 * Fire-and-forget — never throws.
 */
export async function sendPaymentFailed(orgId, plan) {
  try {
    const org = await ownerOf(orgId);
    if (!org?.owner?.email) return;
    const msg = paymentFailedEmail({
      userName: org.owner.name,
      planName: plan.name,
      webUrl: config.verifyBaseUrl,
      locale: org.owner.locale,
    });
    await sendEmail({ to: org.owner.email, ...msg });
  } catch (err) {
    console.error("[billing-mail] payment-failed:", err.message);
  }
}
