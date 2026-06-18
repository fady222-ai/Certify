// Authenticated billing endpoints: list plans, current billing state, start a
// checkout (Stripe/Tap/Paymob or a direct free/dev-mode switch), cancel, and
// downgrade. Gateway callbacks/webhooks live in billingWebhookController.js, and
// the shared state-transition helpers in services/billingService.js.
import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";
import {
  createCheckoutSession as stripeCheckout,
  cancelSubscription as stripeCancelSub,
  isConfigured as stripeConfigured,
} from "../services/stripeService.js";
import {
  createCharge,
  isConfigured as tapConfigured,
} from "../services/tapService.js";
import {
  createHostedCheckout as paymobCheckout,
  isConfigured as paymobConfigured,
} from "../services/paymobService.js";
import {
  presentPlan,
  presentSubscription,
  applyPlanToOrg,
  cancelActiveGatewaySubscription,
} from "../services/billingService.js";

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
      paymob: paymobConfigured(),
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
    gateways: { stripe: stripeConfigured(), tap: tapConfigured(), paymob: paymobConfigured() },
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
  const gw = req.body?.gateway;
  const gateway = gw === "tap" ? "tap" : gw === "paymob" ? "paymob" : "stripe";

  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
  if (!plan || !plan.isActive) return res.status(404).json({ message: "الباقة غير موجودة." });

  const amount = interval === "annual" ? plan.priceYearly : plan.priceMonthly;

  // Free plan — switch directly (cancel any live paid subscription first)
  if (amount === 0) {
    await cancelActiveGatewaySubscription(req.organization.id);
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
  if (gateway === "tap") {
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

  // ── Paymob ────────────────────────────────────────────────────────────────
  if (!paymobConfigured()) {
    await applyPlanToOrg(req.organization.id, plan, { gateway: "paymob", interval, amount });
    return res.json({ message: `تم تفعيل باقة ${plan.name} (وضع تجريبي — لا توجد مفاتيح Paymob).`, plan: presentPlan(plan), dev_mode: true });
  }

  const session = await paymobCheckout({ amountUsd: amount, plan, org: req.organization, user: req.user });

  await prisma.subscription.upsert({
    where: { organizationId: req.organization.id },
    create: {
      organizationId: req.organization.id,
      planId: plan.id,
      gateway: "paymob",
      paymobOrderId: session.paymobOrderId,
      status: "inactive",
      interval,
      amount,
      currency: "USD",
    },
    update: {
      gateway: "paymob",
      paymobOrderId: session.paymobOrderId,
      planId: plan.id,
      status: "inactive",
      interval,
      amount,
      currency: "USD",
    },
  });

  return res.json({ redirect_url: session.redirect_url, order_id: session.paymobOrderId });
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

  await cancelActiveGatewaySubscription(req.organization.id);
  await applyPlanToOrg(req.organization.id, plan, { gateway: "stripe", interval: "monthly", amount: 0 });
  res.json({ message: `تم التبديل إلى باقة ${plan.name}.`, plan: presentPlan(plan) });
}
