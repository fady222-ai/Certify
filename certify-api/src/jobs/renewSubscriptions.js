import cron from "node-cron";
import { prisma } from "../db/prisma.js";
import { createTokenCharge as tapTokenCharge } from "../services/tapService.js";
import { createTokenCharge as paymobTokenCharge } from "../services/paymobService.js";
import { sendPaymentReceipt, sendRenewalReminder, sendPaymentFailed } from "../services/billingMailer.js";

/**
 * Runs daily at 03:00.
 * 1. Renews overdue Tap subscriptions (status=active, periodEnd <= now, cancelAtPeriodEnd=false).
 * 2. Downgrades any subscription (any gateway) that is active, cancelled, and period has ended.
 */
export function startRenewalJob() {
  cron.schedule("0 3 * * *", processRenewals, { timezone: "UTC" });
  console.log("Subscription renewal job scheduled (daily 03:00 UTC).");
}

// Exported for manual triggering in tests / admin tools.
export async function processRenewals() {
  const now = new Date();

  // ── 1. Auto-renew overdue Tap subscriptions ──────────────────────────────
  const tapDue = await prisma.subscription.findMany({
    where: {
      gateway: "tap",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: { lte: now },
      tapCustomerId: { not: null },
      tapCardId: { not: null },
    },
    include: { plan: true, organization: true },
  });

  for (const sub of tapDue) {
    try {
      const amount = sub.interval === "annual" ? sub.plan.priceYearly : sub.plan.priceMonthly;
      const charge = await tapTokenCharge({
        amount,
        currency: sub.currency,
        customerId: sub.tapCustomerId,
        cardId: sub.tapCardId,
        description: `Certify ${sub.plan.name} renewal`,
      });

      if (charge.status === "CAPTURED") {
        const next = new Date(sub.currentPeriodEnd);
        if (sub.interval === "annual") next.setFullYear(next.getFullYear() + 1);
        else next.setMonth(next.getMonth() + 1);

        await prisma.subscription.update({
          where: { id: sub.id },
          data: { tapChargeId: charge.id, currentPeriodStart: sub.currentPeriodEnd, currentPeriodEnd: next },
        });
        sendPaymentReceipt(sub.organizationId, sub.plan, { ...sub, currentPeriodEnd: next }, { isRenewal: true }).catch(() => {});
      } else {
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } });
        sendPaymentFailed(sub.organizationId, sub.plan).catch(() => {});
      }
    } catch (err) {
      console.error(`Tap renewal failed for sub ${sub.id}:`, err.message);
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } }).catch(() => {});
      sendPaymentFailed(sub.organizationId, sub.plan).catch(() => {});
    }
  }

  // ── 2. Auto-renew overdue Paymob card subscriptions ──────────────────────
  // Only card-based Paymob payments have a token; wallet payments (Vodafone Cash,
  // InstaPay) cannot be charged automatically — those users must re-subscribe.
  const paymobDue = await prisma.subscription.findMany({
    where: {
      gateway: "paymob",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: { lte: now },
      paymobCardToken: { not: null },
    },
    include: { plan: true, organization: true },
  });

  for (const sub of paymobDue) {
    try {
      const amountUsd = sub.interval === "annual" ? sub.plan.priceYearly : sub.plan.priceMonthly;
      const charge = await paymobTokenCharge({
        amountUsd,
        cardToken: sub.paymobCardToken,
        description: `Certify ${sub.plan.name} renewal`,
      });

      if (charge.status === "CAPTURED") {
        const next = new Date(sub.currentPeriodEnd);
        if (sub.interval === "annual") next.setFullYear(next.getFullYear() + 1);
        else next.setMonth(next.getMonth() + 1);

        await prisma.subscription.update({
          where: { id: sub.id },
          data: { currentPeriodStart: sub.currentPeriodEnd, currentPeriodEnd: next },
        });
        sendPaymentReceipt(sub.organizationId, sub.plan, { ...sub, currentPeriodEnd: next }, { isRenewal: true }).catch(() => {});
      } else {
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } });
        sendPaymentFailed(sub.organizationId, sub.plan).catch(() => {});
      }
    } catch (err) {
      console.error(`Paymob renewal failed for sub ${sub.id}:`, err.message);
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } }).catch(() => {});
      sendPaymentFailed(sub.organizationId, sub.plan).catch(() => {});
    }
  }

  // ── 3. Send renewal reminders to wallet-based Paymob subscribers ─────────
  // These users paid via Vodafone Cash / InstaPay / Fawry — no card token is
  // saved so auto-renewal is impossible. Warn them 3 days before expiry.
  const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const in4days = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

  const walletExpiring = await prisma.subscription.findMany({
    where: {
      gateway: "paymob",
      paymobCardToken: null,
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: { gte: in3days, lt: in4days },
    },
    include: { plan: true },
  });

  for (const sub of walletExpiring) {
    sendRenewalReminder(sub.organizationId, sub.plan, sub, 3).catch(() => {});
  }

  // ── 2. Downgrade cancelled/expired subscriptions ─────────────────────────
  const expired = await prisma.subscription.findMany({
    where: {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { lte: now },
    },
    include: { organization: true },
  });

  for (const sub of expired) {
    try {
      const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });
      if (!freePlan) continue;

      await prisma.$transaction([
        prisma.organization.update({ where: { id: sub.organizationId }, data: { planId: freePlan.id } }),
        prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "cancelled", planId: freePlan.id, cancelledAt: now, cancelAtPeriodEnd: false },
        }),
      ]);
    } catch (err) {
      console.error(`Downgrade failed for sub ${sub.id}:`, err.message);
    }
  }

  if (tapDue.length + paymobDue.length + expired.length + walletExpiring.length > 0) {
    console.log(`Renewal job: tap=${tapDue.length}, paymob=${paymobDue.length}, downgraded=${expired.length}, reminders=${walletExpiring.length}`);
  }
}
