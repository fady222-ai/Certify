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
import {
  createHostedCheckout as paymobCheckout,
  verifyHmac as paymobVerifyHmac,
  isConfigured as paymobConfigured,
} from "../services/paymobService.js";

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
// GET /api/billing/paymob/callback  (Paymob redirect after payment)
// ─────────────────────────────────────────────────────────────────────────────

export async function handlePaymobCallback(req, res) {
  const webUrl = config.verifyBaseUrl;
  const q = req.query ?? {};

  const success = q.success === "true";
  const pending = q.pending === "true";
  const hmac = q.hmac ?? "";

  // Build params object for HMAC verification (remove hmac itself)
  const { hmac: _h, ...hmacParams } = q;
  if (!paymobVerifyHmac(hmacParams, hmac))
    return res.redirect(`${webUrl}/dashboard/billing?error=verify_failed`);

  if (!success || pending)
    return res.redirect(`${webUrl}/dashboard/billing?error=payment_failed`);

  // Merchant order ID embedded as certify_{orgId}_{ts}
  const merchantOrderId = q.merchant_order_id ?? "";
  const orgId = merchantOrderId.startsWith("certify_") ? merchantOrderId.split("_")[1] : null;
  if (!orgId) return res.redirect(`${webUrl}/dashboard/billing?error=not_found`);

  try {
    const sub = await prisma.subscription.findFirst({
      where: { organizationId: orgId, gateway: "paymob" },
      include: { plan: true },
    });
    if (!sub) return res.redirect(`${webUrl}/dashboard/billing?error=not_found`);

    // `token` query param is the card token for recurring (present for card payments)
    const cardToken = q.token ?? null;

    await applyPlanToOrg(orgId, sub.plan, {
      gateway: "paymob",
      paymobOrderId: sub.paymobOrderId,
      paymobCardToken: cardToken ?? sub.paymobCardToken,
      interval: sub.interval,
      amount: sub.amount ?? 0,
      currency: "USD",
    });

    return res.redirect(`${webUrl}/dashboard/billing?success=1`);
  } catch (err) {
    console.error("Paymob callback error:", err);
    return res.redirect(`${webUrl}/dashboard/billing?error=verify_failed`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/billing/paymob/webhook  (Paymob transaction notification — JSON)
// ─────────────────────────────────────────────────────────────────────────────

export async function handlePaymobWebhook(req, res) {
  const body = req.body ?? {};
  if (body.type !== "TRANSACTION") return res.json({ received: true });

  const obj = body.obj ?? {};
  const hmac = body.hmac ?? "";

  // Build flat params from obj for HMAC verification
  const hmacParams = {
    amount_cents: obj.amount_cents,
    created_at: obj.created_at,
    currency: obj.currency,
    error_occured: obj.error_occured,
    has_parent_transaction: obj.has_parent_transaction,
    id: obj.id,
    integration_id: obj.integration_id,
    is_3d_secure: obj.is_3d_secure,
    is_auth: obj.is_auth,
    is_capture: obj.is_capture,
    is_refunded: obj.is_refunded,
    is_standalone_payment: obj.is_standalone_payment,
    is_voided: obj.is_voided,
    order: obj.order?.id ?? obj.order,
    owner: obj.owner?.id ?? obj.owner,
    pending: obj.pending,
    "source_data.pan": obj.source_data?.pan,
    "source_data.sub_type": obj.source_data?.sub_type,
    "source_data.type": obj.source_data?.type,
    success: obj.success,
  };

  if (!paymobVerifyHmac(hmacParams, hmac))
    return res.status(401).json({ message: "Invalid HMAC." });

  const merchantOrderId = obj.order?.merchant_order_id ?? "";
  const orgId = merchantOrderId.startsWith("certify_") ? merchantOrderId.split("_")[1] : null;
  if (!orgId) return res.json({ received: true });

  try {
    const sub = await prisma.subscription.findFirst({
      where: { organizationId: orgId, gateway: "paymob" },
      include: { plan: true },
    });
    if (!sub) return res.json({ received: true });

    if (obj.success === true && obj.pending === false) {
      if (sub.status !== "active") {
        const cardToken = obj.token ?? obj.payment_key_claims?.token ?? null;
        await applyPlanToOrg(orgId, sub.plan, {
          gateway: "paymob",
          paymobOrderId: sub.paymobOrderId,
          paymobCardToken: cardToken ?? sub.paymobCardToken,
          interval: sub.interval,
          amount: sub.amount ?? 0,
          currency: "USD",
        });
      }
    } else if (obj.success === false && obj.pending === false) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } });
    }
  } catch (err) {
    console.error("Paymob webhook error:", err);
  }

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
