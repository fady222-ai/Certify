import { prisma } from "../db/prisma.js";

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

/** GET /api/plans — public list of active plans (for pricing + upgrade UI). */
export async function listPlans(_req, res) {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceMonthly: "asc" },
  });
  res.json({ data: plans.map(presentPlan) });
}

/**
 * GET /api/billing — current org plan + this-month usage.
 */
export async function getBilling(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });

  const org = req.organization;
  const month = new Date().toISOString().slice(0, 7);

  const [plan, usage] = await Promise.all([
    org.planId ? prisma.plan.findUnique({ where: { id: org.planId } }) : null,
    prisma.certificateUsage.findUnique({
      where: { organizationId_month: { organizationId: org.id, month } },
    }),
  ]);

  const used = usage?.certificatesIssued ?? 0;
  const limit = plan?.certificatesPerMonth ?? null;

  res.json({
    plan: plan ? presentPlan(plan) : null,
    usage: {
      month,
      used,
      limit,
      remaining: limit != null ? Math.max(0, limit - used) : null,
    },
  });
}

/**
 * POST /api/billing/plan  { slug }
 * Switch the organization's plan.
 *
 * NOTE: real billing goes through Stripe Checkout in production. In this
 * environment (no payment keys) we switch the plan directly so plan-limit
 * enforcement can be exercised end-to-end. Paid plans are flagged accordingly.
 */
export async function changePlan(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });

  // Only the org owner may change the plan.
  if (req.organization.ownerId !== req.user.id) {
    return res.status(403).json({ message: "فقط مالك المنظمة يمكنه تغيير الباقة." });
  }

  const slug = (req.body?.slug ?? "").toString().trim();
  const plan = await prisma.plan.findUnique({ where: { slug } });
  if (!plan || !plan.isActive) {
    return res.status(404).json({ message: "الباقة غير موجودة." });
  }

  await prisma.organization.update({
    where: { id: req.organization.id },
    data: { planId: plan.id },
  });

  res.json({
    message:
      plan.priceMonthly > 0
        ? `تم تفعيل باقة ${plan.name} (وضع تجريبي بدون دفع فعلي).`
        : `تم التبديل إلى باقة ${plan.name}.`,
    plan: presentPlan(plan),
    requires_payment: plan.priceMonthly > 0,
  });
}
