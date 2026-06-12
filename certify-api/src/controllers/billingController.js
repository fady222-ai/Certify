import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";
import {
  createCheckoutSession as stripeCheckout,
  cancelSubscription as stripeCancelSub,
  constructWebhookEvent,
  isConfigured as stripeConfigured,
} from "../services/stripeService.js";
import {
  createCharge,
  retrieveCharge,
  verifyWebhookSignature,
  isConfigured as tapConfigured,
} from "../services/tapService.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function presentPlan(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price_monthly: p.priceMonthly,
    price_yearly: p.priceYearly,
    certificates_per_month: p.certificatesPerMonth,
    templates_limit: p.templatesLimit,
    team_members_limit: p.teamMembersLimit,
    has_api: p.hasApi,
    has_white_label: p.hasWhiteLabel,
  };
}

function presentSubscription(sub) {
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

async function applyPlanToOrg(orgId, plan, subData) {
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Public — plan list
// ─────────────────────────────────────────────────────────────────────────────

export async function listPlans(_req, res) {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceMonthly: "asc" },
  });
  res.json({
    data: plans.map(presentPlan),
    gateways: {
      stripe: stripeConfigured(),
      tap: tapConfigured(),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/billing
// ─────────────────────────────────────────────────────────────────────────────

export async function getBilling(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });

  const org = req.organization;
  const month = new Date().toISOString().slice(0, 7);

  const [plan, usage, subscription] = await Promise.all([
    org.planId ? prisma.plan.findUnique({ where: { id: org.planId } }) : null,
    prisma.certificateUsage.findUnique({
      where: { organizationId_month: { organizationId: org.id, month } },
    }),
    prisma.subscription.findUnique({ where: { organizationId: org.id } }),
  ]);

  const used = usage?.certificatesIssued ?? 0;
  const limit = plan?.certificatesPerMonth ?? null;

  res.json({
    plan: plan ? presentPlan(plan) : null,
    subscription: presentSubscription(subscription),
    usage: { month, used, limit, remaining: limit != null ? Math.max(0, limit - used) : null },
    gateways: { stripe: stripeConfigured(), tap: tapConfigured() },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/billing/checkout  { plan_slug, interval, gateway }
// ─────────────────────────────────────────────────────────────────────────────

export async function createCheckout(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
  if (req.organization.ownerId !== req.user.id)
    return res.status(403).json({ message: "فقط مالك المنظمة يمكنه إدارة الاشتراك." });

  const planSlug = (req.body?.plan_slug ?? "").toString().trim();
  const interval = req.body?.interval === "annual" ? "annual" : "monthly";
  const gateway = req.body?.gateway === "tap" ? "tap" : "stripe";

  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
  if (!plan || !plan.isActive) return res.status(404).json({ message: "الباقة غير موجودة." });

  const amount = interval === "annual" ? plan.priceYearly : plan.priceMonthly;

  // Free plan — switch directly
  if (amount === 0) {
    await applyPlanToOrg(req.organization.id, plan, { gateway: "stripe", interval, amount: 0 });
    return res.json({ message: `تم التحويل إلى باقة ${plan.name}.`, plan: presentPlan(plan) });
  }

  // ── Stripe ────────────────────────────────────────────────────────────────
  if (gateway === "stripe") {
    if (!stripeConfigured()) {
      // dev mode — switch directly
      await applyPlanToOrg(req.organization.id, plan, { gateway: "stripe", interval, amount });
      return res.json({ message: `تم تفعيل باقة ${plan.name} (وضع تجريبي — لا توجد مفاتيح Stripe).`, plan: presentPlan(plan), dev_mode: true });
    }

    const existingSub = await prisma.subscription.findUnique({ where: { organizationId: req.organization.id } });
    const webUrl = config.verifyBaseUrl;

    const session = await stripeCheckout({
      plan,
      interval,
      org: req.organization,
      user: req.user,
      existingCustomerId: existingSub?.stripeCustomerId ?? null,
      successUrl: `${webUrl}/dashboard/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${webUrl}/dashboard/billing?error=cancelled`,
    });

    // Store pending customer reference
    await prisma.subscription.upsert({
      where: { organizationId: req.organization.id },
      create: {
        organizationId: req.organization.id,
        planId: plan.id,
        gateway: "stripe",
        stripeCustomerId: session.customer_id,
        status: "inactive",
        interval,
        amount,
        currency: "USD",
      },
      update: {
        gateway: "stripe",
        stripeCustomerId: session.customer_id,
        planId: plan.id,
        status: "inactive",
        interval,
        amount,
        currency: "USD",
      },
    });

    return res.json({ redirect_url: session.redirect_url, session_id: session.id });
  }

  // ── Tap ───────────────────────────────────────────────────────────────────
  if (!tapConfigured()) {
    await applyPlanToOrg(req.organization.id, plan, { gateway: "tap", interval, amount });
    return res.json({ message: `تم تفعيل باقة ${plan.name} (وضع تجريبي — لا توجد مفاتيح Tap).`, plan: presentPlan(plan), dev_mode: true });
  }

  const callbackUrl = `${config.appUrl}/api/billing/callback`;
  const charge = await createCharge({
    amount,
    currency: "USD",
    org: req.organization,
    user: req.user,
    planName: plan.name,
    interval,
    callbackUrl,
  });

  await prisma.subscription.upsert({
    where: { organizationId: req.organization.id },
    create: {
      organizationId: req.organization.id,
      planId: plan.id,
      gateway: "tap",
      tapChargeId: charge.id,
      status: "inactive",
      interval,
      amount,
      currency: "USD",
    },
    update: {
      gateway: "tap",
      tapChargeId: charge.id,
      planId: plan.id,
      status: "inactive",
      interval,
      amount,
      currency: "USD",
    },
  });

  return res.json({ redirect_url: charge.redirect_url, charge_id: charge.id });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/billing/callback  (Tap redirect)
// ─────────────────────────────────────────────────────────────────────────────

export async function handleCallback(req, res) {
  const tapId = req.query?.tap_id ?? req.query?.id;
  const webUrl = config.verifyBaseUrl;

  if (!tapId) return res.redirect(`${webUrl}/dashboard/billing?error=missing_id`);

  try {
    const charge = await retrieveCharge(tapId);
    if (charge.status !== "CAPTURED")
      return res.redirect(`${webUrl}/dashboard/billing?error=payment_failed`);

    const sub = await prisma.subscription.findFirst({
      where: { tapChargeId: tapId },
      include: { plan: true },
    });
    if (!sub) return res.redirect(`${webUrl}/dashboard/billing?error=not_found`);

    await applyPlanToOrg(sub.organizationId, sub.plan, {
      gateway: "tap",
      tapChargeId: tapId,
      tapCustomerId: charge.customer?.id ?? sub.tapCustomerId,
      tapCardId: charge.card?.id ?? sub.tapCardId,
      interval: sub.interval,
      amount: sub.amount ?? 0,
      currency: "USD",
    });

    return res.redirect(`${webUrl}/dashboard/billing?success=1`);
  } catch (err) {
    console.error("Tap callback error:", err);
    return res.redirect(`${webUrl}/dashboard/billing?error=verify_failed`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/billing/webhook  (Tap — raw body)
// ─────────────────────────────────────────────────────────────────────────────

export async function handleTapWebhook(req, res) {
  const signature = req.headers["hashdigest"] ?? req.headers["x-tap-signature"] ?? "";

  if (!verifyWebhookSignature(req.rawBody ?? "", signature))
    return res.status(401).json({ message: "Invalid signature." });

  let event;
  try { event = JSON.parse(req.rawBody ?? "{}"); } catch { return res.status(400).json({ message: "Invalid JSON." }); }

  const chargeId = event?.id ?? event?.charge?.id;
  const status = event?.status ?? event?.charge?.status;
  if (!chargeId) return res.json({ received: true });

  try {
    if (status === "CAPTURED") {
      const sub = await prisma.subscription.findFirst({ where: { tapChargeId: chargeId }, include: { plan: true } });
      if (sub && sub.status !== "active") {
        await applyPlanToOrg(sub.organizationId, sub.plan, {
          gateway: "tap",
          tapChargeId: chargeId,
          tapCustomerId: event.customer?.id ?? sub.tapCustomerId,
          tapCardId: event.card?.id ?? sub.tapCardId,
          interval: sub.interval,
          amount: sub.amount ?? 0,
          currency: "USD",
        });
      }
    } else if (["FAILED", "DECLINED", "CANCELLED"].includes(status)) {
      await prisma.subscription.updateMany({ where: { tapChargeId: chargeId }, data: { status: "past_due" } });
    }
  } catch (err) { console.error("Tap webhook error:", err); }

  res.json({ received: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/billing/stripe/webhook  (Stripe — raw body)
// ─────────────────────────────────────────────────────────────────────────────

export async function handleStripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"] ?? "";
  let event;

  try {
    event = constructWebhookEvent(req.rawBody ?? "", sig);
  } catch (err) {
    return res.status(400).json({ message: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const { org_id, plan_slug, interval } = session.metadata ?? {};
        if (!org_id || !plan_slug) break;

        const plan = await prisma.plan.findUnique({ where: { slug: plan_slug } });
        if (!plan) break;

        const amount = interval === "annual" ? plan.priceYearly : plan.priceMonthly;

        await applyPlanToOrg(org_id, plan, {
          gateway: "stripe",
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          interval: interval ?? "monthly",
          amount,
          currency: "USD",
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;
        if (!stripeSubId) break;

        const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: stripeSubId } });
        if (!sub) break;

        // Extend period by one billing cycle
        const now = new Date();
        const next = new Date(now);
        if (sub.interval === "annual") next.setFullYear(next.getFullYear() + 1);
        else next.setMonth(next.getMonth() + 1);

        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "active", currentPeriodStart: now, currentPeriodEnd: next },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;
        if (stripeSubId) {
          await prisma.subscription.updateMany({ where: { stripeSubscriptionId: stripeSubId }, data: { status: "past_due" } });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const stripeSub = event.data.object;
        const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: stripeSub.id } });
        if (!sub) break;

        const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });
        if (freePlan) {
          await prisma.$transaction([
            prisma.organization.update({ where: { id: sub.organizationId }, data: { planId: freePlan.id } }),
            prisma.subscription.update({ where: { id: sub.id }, data: { status: "cancelled", planId: freePlan.id, cancelledAt: new Date() } }),
          ]);
        }
        break;
      }

      case "customer.subscription.updated": {
        const stripeSub = event.data.object;
        if (stripeSub.cancel_at_period_end) {
          await prisma.subscription.updateMany({ where: { stripeSubscriptionId: stripeSub.id }, data: { cancelAtPeriodEnd: true } });
        }
        break;
      }
    }
  } catch (err) {
    console.error("Stripe webhook processing error:", err);
  }

  res.json({ received: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/billing/cancel
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelSubscription(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
  if (req.organization.ownerId !== req.user.id)
    return res.status(403).json({ message: "فقط مالك المنظمة يمكنه إلغاء الاشتراك." });

  const sub = await prisma.subscription.findUnique({ where: { organizationId: req.organization.id } });
  if (!sub || sub.status !== "active")
    return res.status(400).json({ message: "لا يوجد اشتراك نشط للإلغاء." });

  if (sub.gateway === "stripe" && sub.stripeSubscriptionId && stripeConfigured()) {
    await stripeCancelSub(sub.stripeSubscriptionId, true);
  }

  await prisma.subscription.update({
    where: { organizationId: req.organization.id },
    data: { cancelAtPeriodEnd: true },
  });

  res.json({ message: "تم جدولة إلغاء الاشتراك. ستبقى على باقتك الحالية حتى نهاية الدورة." });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/billing/plan  (downgrade to free directly)
// ─────────────────────────────────────────────────────────────────────────────

export async function changePlan(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
  if (req.organization.ownerId !== req.user.id)
    return res.status(403).json({ message: "فقط مالك المنظمة يمكنه تغيير الباقة." });

  const slug = (req.body?.slug ?? "").toString().trim();
  const plan = await prisma.plan.findUnique({ where: { slug } });
  if (!plan || !plan.isActive) return res.status(404).json({ message: "الباقة غير موجودة." });

  if (plan.priceMonthly > 0) {
    return res.status(400).json({
      message: "الترقية إلى الباقات المدفوعة تتم عبر /billing/checkout.",
      requires_checkout: true,
    });
  }

  await applyPlanToOrg(req.organization.id, plan, { gateway: "stripe", interval: "monthly", amount: 0 });
  res.json({ message: `تم التبديل إلى باقة ${plan.name}.`, plan: presentPlan(plan) });
}
