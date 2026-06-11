import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";
import { createCharge, retrieveCharge, verifyWebhookSignature } from "../services/tapService.js";

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
    status: sub.status,
    interval: sub.interval,
    amount: sub.amount,
    currency: sub.currency,
    current_period_end: sub.currentPeriodEnd,
    cancelled_at: sub.cancelledAt,
  };
}

/** GET /api/plans — public list of active plans. */
export async function listPlans(_req, res) {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceMonthly: "asc" },
  });
  res.json({ data: plans.map(presentPlan) });
}

/** GET /api/billing — current org plan + this-month usage + subscription. */
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
    usage: {
      month,
      used,
      limit,
      remaining: limit != null ? Math.max(0, limit - used) : null,
    },
  });
}

/**
 * POST /api/billing/checkout  { plan_slug, interval }
 * Creates a Tap charge and returns redirect_url.
 * When TAP_SECRET_KEY is not configured, switches plan directly (dev mode).
 */
export async function createCheckout(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
  if (req.organization.ownerId !== req.user.id) {
    return res.status(403).json({ message: "فقط مالك المنظمة يمكنه إدارة الاشتراك." });
  }

  const planSlug = (req.body?.plan_slug ?? "").toString().trim();
  const interval = req.body?.interval === "annual" ? "annual" : "monthly";

  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
  if (!plan || !plan.isActive) {
    return res.status(404).json({ message: "الباقة غير موجودة." });
  }

  const amount = interval === "annual" ? plan.priceYearly : plan.priceMonthly;

  // Free plan — switch directly
  if (amount === 0) {
    await applyPlanToOrg(req.organization.id, plan, null, interval, 0);
    return res.json({ message: `تم التحويل إلى باقة ${plan.name}.`, plan: presentPlan(plan) });
  }

  // No Tap key — dev mode
  if (!config.tapSecretKey) {
    await applyPlanToOrg(req.organization.id, plan, null, interval, amount);
    return res.json({
      message: `تم تفعيل باقة ${plan.name} (وضع تجريبي).`,
      plan: presentPlan(plan),
      dev_mode: true,
    });
  }

  const callbackUrl = `${config.appUrl}/api/billing/callback`;

  const charge = await createCharge({
    amount,
    currency: "SAR",
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
      tapChargeId: charge.id,
      status: "inactive",
      interval,
      amount,
      currency: "SAR",
    },
    update: {
      tapChargeId: charge.id,
      planId: plan.id,
      status: "inactive",
      interval,
      amount,
      currency: "SAR",
    },
  });

  res.json({ redirect_url: charge.redirect_url, charge_id: charge.id });
}

/**
 * GET /api/billing/callback?tap_id=xxx
 * Tap redirects here after payment.
 */
export async function handleCallback(req, res) {
  const tapId = req.query?.tap_id ?? req.query?.id;
  const webUrl = config.verifyBaseUrl;

  if (!tapId) return res.redirect(`${webUrl}/dashboard/billing?error=missing_id`);

  try {
    const charge = await retrieveCharge(tapId);

    if (charge.status !== "CAPTURED") {
      return res.redirect(`${webUrl}/dashboard/billing?error=payment_failed`);
    }

    const sub = await prisma.subscription.findFirst({
      where: { tapChargeId: tapId },
      include: { plan: true },
    });

    if (!sub) return res.redirect(`${webUrl}/dashboard/billing?error=not_found`);

    await applyPlanToOrg(sub.organizationId, sub.plan, tapId, sub.interval, sub.amount ?? 0);

    return res.redirect(`${webUrl}/dashboard/billing?success=1`);
  } catch (err) {
    console.error("Tap callback error:", err);
    return res.redirect(`${webUrl}/dashboard/billing?error=verify_failed`);
  }
}

/**
 * POST /api/billing/webhook  (raw body — express.json() must be skipped for this route)
 */
export async function handleWebhook(req, res) {
  const signature = req.headers["hashdigest"] ?? req.headers["x-tap-signature"] ?? "";

  if (!verifyWebhookSignature(req.rawBody ?? "", signature)) {
    return res.status(401).json({ message: "Invalid signature." });
  }

  let event;
  try {
    event = req.rawBody ? JSON.parse(req.rawBody) : req.body;
  } catch {
    return res.status(400).json({ message: "Invalid JSON." });
  }

  const chargeId = event?.id ?? event?.charge?.id;
  const status = event?.status ?? event?.charge?.status;

  if (!chargeId) return res.json({ received: true });

  try {
    if (status === "CAPTURED") {
      const sub = await prisma.subscription.findFirst({
        where: { tapChargeId: chargeId },
        include: { plan: true },
      });
      if (sub && sub.status !== "active") {
        await applyPlanToOrg(sub.organizationId, sub.plan, chargeId, sub.interval, sub.amount ?? 0);
      }
    } else if (["FAILED", "DECLINED", "CANCELLED"].includes(status)) {
      await prisma.subscription.updateMany({
        where: { tapChargeId: chargeId },
        data: { status: "past_due" },
      });
    }
  } catch (err) {
    console.error("Webhook error:", err);
  }

  res.json({ received: true });
}

/**
 * POST /api/billing/cancel
 */
export async function cancelSubscription(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
  if (req.organization.ownerId !== req.user.id) {
    return res.status(403).json({ message: "فقط مالك المنظمة يمكنه إلغاء الاشتراك." });
  }

  const sub = await prisma.subscription.findUnique({ where: { organizationId: req.organization.id } });
  if (!sub || sub.status !== "active") {
    return res.status(400).json({ message: "لا يوجد اشتراك نشط للإلغاء." });
  }

  await prisma.subscription.update({
    where: { organizationId: req.organization.id },
    data: { status: "cancelled", cancelledAt: new Date() },
  });

  res.json({ message: "تم إلغاء الاشتراك. ستبقى على باقتك الحالية حتى نهاية الدورة." });
}

/**
 * POST /api/billing/plan  { slug }  — kept for free-plan downgrades
 */
export async function changePlan(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
  if (req.organization.ownerId !== req.user.id) {
    return res.status(403).json({ message: "فقط مالك المنظمة يمكنه تغيير الباقة." });
  }

  const slug = (req.body?.slug ?? "").toString().trim();
  const plan = await prisma.plan.findUnique({ where: { slug } });
  if (!plan || !plan.isActive) return res.status(404).json({ message: "الباقة غير موجودة." });

  if (plan.priceMonthly > 0) {
    return res.status(400).json({
      message: "الترقية إلى الباقات المدفوعة تتم عبر /billing/checkout.",
      requires_checkout: true,
    });
  }

  await applyPlanToOrg(req.organization.id, plan, null, "monthly", 0);
  res.json({ message: `تم التبديل إلى باقة ${plan.name}.`, plan: presentPlan(plan) });
}

// ---- internal helper ----

async function applyPlanToOrg(orgId, plan, tapChargeId, interval, amount) {
  const now = new Date();
  const periodEnd = new Date(now);
  if (interval === "annual") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  await prisma.$transaction([
    prisma.organization.update({ where: { id: orgId }, data: { planId: plan.id } }),
    prisma.subscription.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        planId: plan.id,
        tapChargeId,
        status: amount > 0 ? "active" : "inactive",
        interval,
        amount,
        currency: "SAR",
        currentPeriodStart: now,
        currentPeriodEnd: amount > 0 ? periodEnd : null,
      },
      update: {
        planId: plan.id,
        tapChargeId: tapChargeId ?? undefined,
        status: amount > 0 ? "active" : "inactive",
        interval,
        amount,
        currentPeriodStart: now,
        currentPeriodEnd: amount > 0 ? periodEnd : null,
        cancelledAt: null,
      },
    }),
  ]);
}
