// Shared billing domain helpers used by the billing controllers (checkout +
// webhooks). Extracted from billingController.js so the HTTP handlers stay
// focused and the core state transitions (apply a plan to an org, cancel a
// gateway subscription, webhook idempotency) live in one place.
import { prisma } from "../db/prisma.js";
import { cancelSubscription as stripeCancelSub, isConfigured as stripeConfigured } from "./stripeService.js";
import { sendPaymentReceipt } from "./billingMailer.js";
import { logMailFailure } from "./email/index.js";

/** Shape a Plan row for the API. */
export function presentPlan(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price_monthly: p.priceMonthly,
    price_yearly: p.priceYearly,
    certificates_per_month: p.certificatesPerMonth,
    templates_limit: p.templatesLimit,
    team_members_limit: p.teamMembersLimit,
    has_bulk_issuance: p.hasBulkIssuance,
    has_api: p.hasApi,
  };
}

/** Shape a Subscription row for the API. */
export function presentSubscription(sub) {
  if (!sub) return null;
  return {
    gateway: sub.gateway,
    status: sub.status,
    interval: sub.interval,
    amount: sub.amount,
    currency: sub.currency,
    cancel_at_period_end: sub.cancelAtPeriodEnd,
    current_period_end: sub.currentPeriodEnd,
    cancelled_at: sub.cancelledAt,
  };
}

/** Switch an org to `plan` and (re)write its subscription row for one period. */
export async function applyPlanToOrg(orgId, plan, subData, { notify = false } = {}) {
  const now = new Date();
  const periodEnd = new Date(now);
  if (subData.interval === "annual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  const amount = subData.amount ?? 0;

  await prisma.$transaction([
    prisma.organization.update({ where: { id: orgId }, data: { planId: plan.id } }),
    prisma.subscription.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        planId: plan.id,
        status: amount > 0 ? "active" : "inactive",
        currency: "USD",
        currentPeriodStart: now,
        currentPeriodEnd: amount > 0 ? periodEnd : null,
        cancelAtPeriodEnd: false,
        ...subData,
      },
      update: {
        planId: plan.id,
        status: amount > 0 ? "active" : "inactive",
        currentPeriodStart: now,
        currentPeriodEnd: amount > 0 ? periodEnd : null,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        ...subData,
      },
    }),
  ]);

  if (notify && amount > 0) {
    sendPaymentReceipt(orgId, plan, { ...subData, currentPeriodEnd: periodEnd }).catch(logMailFailure(`payment receipt for org ${orgId}`));
  }
}

/**
 * Cancel any active paid subscription at the gateway before switching an org to
 * the free plan. Without this, a downgrade leaves the Stripe subscription live
 * and the customer keeps getting billed (and `invoice.paid` would re-extend it).
 * Best-effort: a gateway error must not block the downgrade.
 */
export async function cancelActiveGatewaySubscription(orgId) {
  const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
  if (!sub) return;

  if (sub.gateway === "stripe" && sub.stripeSubscriptionId && stripeConfigured()) {
    try {
      await stripeCancelSub(sub.stripeSubscriptionId, false); // cancel immediately
    } catch (err) {
      console.error(`Stripe cancel on downgrade failed for org ${orgId}:`, err.message);
    }
  }
  // Tap/Paymob are charge-based: dropping to amount=0 sets status "inactive",
  // which the renewal cron skips — no gateway-side cancellation needed.
}

/**
 * Idempotency guard for webhooks. Returns true if this (gateway, eventId) is new
 * and should be processed; false if it was already handled (a retry/replay).
 * Gateways re-deliver events (e.g. Stripe `invoice.paid`), and without this a
 * retry would extend a period twice or re-activate a cancelled subscription.
 * Best-effort: if eventId is missing we process (can't dedupe) rather than drop.
 */
export async function isFreshWebhookEvent(gateway, eventId) {
  if (!eventId) return true;
  try {
    await prisma.webhookEvent.create({ data: { gateway, eventId: String(eventId) } });
    return true;
  } catch (err) {
    if (err?.code === "P2002") return false; // unique violation → already processed
    throw err;
  }
}
