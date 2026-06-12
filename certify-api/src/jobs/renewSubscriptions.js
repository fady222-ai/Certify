import cron from "node-cron";
import { prisma } from "../db/prisma.js";
import { createTokenCharge } from "../services/tapService.js";

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
      const charge = await createTokenCharge({
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
          data: {
            tapChargeId: charge.id,
            currentPeriodStart: sub.currentPeriodEnd,
            currentPeriodEnd: next,
          },
        });
      } else {
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } });
      }
    } catch (err) {
      console.error(`Renewal failed for sub ${sub.id}:`, err.message);
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } }).catch(() => {});
    }
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

  if (tapDue.length + expired.length > 0) {
    console.log(`Renewal job: renewed ${tapDue.length}, downgraded ${expired.length}`);
  }
}
