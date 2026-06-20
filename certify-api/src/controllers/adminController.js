import { prisma } from "../db/prisma.js";
import { resendOtp } from "../services/authService.js";
import {
  GATEWAY_SPECS,
  presentAllGateways,
  presentGateway,
  validateGatewayFields,
  mergeGatewayFields,
  missingRequiredFields,
  readStoredFields,
  saveGatewayConfig,
  deleteGatewayConfig,
} from "../services/gatewayConfig.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function presentOrg(org, usage, certTotal) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    owner_name: org.owner?.name ?? null,
    owner_email: org.owner?.email ?? null,
    plan: org.plan ? { slug: org.plan.slug, name: org.plan.name, limit: org.plan.certificatesPerMonth } : null,
    certs_this_month: usage?.certificatesIssued ?? 0,
    certs_total: certTotal,
    suspended: !!org.suspendedAt,
    suspended_at: org.suspendedAt ?? null,
    created_at: org.createdAt,
  };
}

// ── handlers ─────────────────────────────────────────────────────────────────

/** GET /api/admin/stats — platform-wide numbers */
export async function getAdminStats(_req, res) {
  const month = currentMonth();
  const startOfMonth = new Date(`${month}-01T00:00:00.000Z`);

  const [
    totalOrgs, totalUsers, totalCerts, monthUsage, newOrgsThisMonth,
    activeSubs, pastDue, cancelling, suspendedOrgs, openTickets,
    planRows, orgPlanGroups, recentOrgs,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.certificate.count(),
    prisma.certificateUsage.aggregate({ where: { month }, _sum: { certificatesIssued: true } }),
    prisma.organization.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.subscription.findMany({ where: { status: "active" }, select: { amount: true, interval: true } }),
    prisma.subscription.count({ where: { status: "past_due" } }),
    prisma.subscription.count({ where: { status: "active", cancelAtPeriodEnd: true } }),
    prisma.organization.count({ where: { suspendedAt: { not: null } } }),
    prisma.supportTicket.count({ where: { status: "open" } }),
    prisma.plan.findMany({ select: { id: true, slug: true, name: true } }),
    prisma.organization.groupBy({ by: ["planId"], _count: { _all: true } }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { owner: { select: { name: true, email: true } }, plan: true },
    }),
  ]);

  const recentCertTotals = await Promise.all(
    recentOrgs.map((o) => prisma.certificate.count({ where: { organizationId: o.id } }))
  );

  // MRR: normalise every active subscription to a monthly amount (annual / 12).
  const mrr = activeSubs.reduce(
    (sum, s) => sum + (s.interval === "annual" ? (s.amount ?? 0) / 12 : (s.amount ?? 0)),
    0,
  );

  // Plan distribution across all organizations (null planId → free bucket).
  const planById = Object.fromEntries(planRows.map((p) => [p.id, p]));
  const distMap = new Map();
  for (const g of orgPlanGroups) {
    const p = g.planId ? planById[g.planId] : null;
    const slug = p?.slug ?? "free";
    const name = p?.name ?? "مجانية";
    const prev = distMap.get(slug);
    distMap.set(slug, { slug, name, count: (prev?.count ?? 0) + g._count._all });
  }
  const order = { free: 0, pro: 1, business: 2 };
  const planDistribution = [...distMap.values()].sort(
    (a, b) => (order[a.slug] ?? 99) - (order[b.slug] ?? 99),
  );

  res.json({
    total_organizations: totalOrgs,
    total_users: totalUsers,
    total_certificates: totalCerts,
    certificates_this_month: monthUsage._sum.certificatesIssued ?? 0,
    new_orgs_this_month: newOrgsThisMonth,
    mrr: Math.round(mrr),
    arr: Math.round(mrr * 12),
    active_subscriptions: activeSubs.length,
    paid_conversion_pct: totalOrgs ? Math.round((activeSubs.length / totalOrgs) * 100) : 0,
    past_due: pastDue,
    cancelling,
    suspended_orgs: suspendedOrgs,
    open_tickets: openTickets,
    plan_distribution: planDistribution,
    recent_organizations: recentOrgs.map((o, i) => presentOrg(o, null, recentCertTotals[i])),
  });
}

/** GET /api/admin/organizations — full org list with usage */
export async function listAdminOrganizations(req, res) {
  const search = (req.query.search ?? "").toString().trim();
  const month = currentMonth();

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { owner: { email: { contains: search, mode: "insensitive" } } },
          { owner: { name: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  const [orgs, usageRows] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        owner: { select: { name: true, email: true } },
        plan: true,
        _count: { select: { certificates: true } },
      },
    }),
    prisma.certificateUsage.findMany({
      where: { month },
    }),
  ]);

  const usageMap = Object.fromEntries(usageRows.map((u) => [u.organizationId, u]));

  res.json({
    data: orgs.map((o) => presentOrg(o, usageMap[o.id], o._count.certificates)),
  });
}

/** GET /api/admin/organizations/:id — full drill-down detail for one org. */
export async function getAdminOrganization(req, res) {
  const { id } = req.params;
  const month = currentMonth();

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true, email: true, emailVerified: true, createdAt: true } },
      plan: true,
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { templates: true, certificates: true, batches: true, members: true, supportTickets: true } },
    },
  });
  if (!org) return res.status(404).json({ message: "المنظمة غير موجودة." });

  const usage = await prisma.certificateUsage.findUnique({
    where: { organizationId_month: { organizationId: id, month } },
  });

  const sub = org.subscriptions?.[0] ?? null;
  res.json({
    ...presentOrg(org, usage, org._count.certificates),
    updated_at: org.updatedAt,
    owner_verified: !!org.owner?.emailVerified,
    owner_joined_at: org.owner?.createdAt ?? null,
    branding: { logo_url: org.logoUrl, primary_color: org.primaryColor },
    subscription: sub
      ? {
          status: sub.status,
          interval: sub.interval,
          amount: sub.amount,
          currency: sub.currency,
          gateway: sub.gateway,
          current_period_end: sub.currentPeriodEnd,
          cancel_at_period_end: sub.cancelAtPeriodEnd,
        }
      : null,
    counts: {
      templates: org._count.templates,
      certificates: org._count.certificates,
      batches: org._count.batches,
      members: org._count.members,
      support_tickets: org._count.supportTickets,
    },
  });
}

/** PATCH /api/admin/organizations/:id/plan — change any org's plan */
export async function adminChangePlan(req, res) {
  const { id } = req.params;
  const slug = (req.body?.slug ?? "").toString().trim();

  const plan = await prisma.plan.findUnique({ where: { slug } });
  if (!plan) return res.status(404).json({ message: "الباقة غير موجودة." });

  const exists = await prisma.organization.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ message: "المنظمة غير موجودة." });

  // The admin manages their own plan through normal billing, not the admin
  // panel — block self-edits here to avoid surprising side effects.
  if (exists.ownerId === req.user.id) {
    return res.status(400).json({ message: "لا يمكنك تغيير باقة منظمتك الخاصة من هنا." });
  }

  const org = await prisma.organization.update({
    where: { id },
    data: { planId: plan.id },
    include: { owner: { select: { name: true, email: true } }, plan: true },
  });

  res.json({ message: `تم تغيير باقة ${org.name} إلى ${plan.name}.`, organization: presentOrg(org, null, 0) });
}

/** PATCH /api/admin/organizations/:id/suspend — toggle suspend */
export async function adminToggleSuspend(req, res) {
  const { id } = req.params;

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) return res.status(404).json({ message: "المنظمة غير موجودة." });

  // Guard against self-lockout: suspending your own org would block requireAuth
  // for every request — including the admin panel — with no way back in.
  if (org.ownerId === req.user.id) {
    return res.status(400).json({ message: "لا يمكنك إيقاف منظمتك الخاصة." });
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: { suspendedAt: org.suspendedAt ? null : new Date() },
    include: { owner: { select: { name: true, email: true } }, plan: true },
  });

  const action = updated.suspendedAt ? "إيقاف" : "تفعيل";
  res.json({ message: `تم ${action} منظمة ${updated.name}.`, organization: presentOrg(updated, null, 0) });
}

/** POST /api/admin/organizations/:id/resend-otp — resend the owner's verification code. */
export async function adminResendOwnerOtp(req, res, next) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: { owner: { select: { emailVerified: true } } },
    });
    if (!org || !org.owner) return res.status(404).json({ message: "المنظمة غير موجودة." });
    if (org.owner.emailVerified) {
      return res.status(400).json({ message: "بريد المالك مُحقّق بالفعل." });
    }
    await resendOtp({ userId: org.ownerId });
    res.json({ message: "تم إرسال رمز تحقق جديد إلى بريد المالك." });
  } catch (e) {
    next(e);
  }
}

/** POST /api/admin/organizations/:id/verify-email — mark the owner's email verified. */
export async function adminVerifyOwnerEmail(req, res, next) {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ message: "المنظمة غير موجودة." });

    await prisma.user.update({ where: { id: org.ownerId }, data: { emailVerified: true } });
    // Invalidate any outstanding verification codes — no longer needed.
    await prisma.verificationToken.deleteMany({ where: { userId: org.ownerId } });
    res.json({ message: "تم تحويل بريد المالك إلى «مُحقّق»." });
  } catch (e) {
    next(e);
  }
}

// ── Payment gateway credentials (admin only) ─────────────────────────────────

/** GET /api/admin/payment-gateways — masked status of every gateway. */
export async function listPaymentGateways(_req, res) {
  res.json({ data: presentAllGateways() });
}

/**
 * PUT /api/admin/payment-gateways/:gateway — set/update credentials.
 * Body: { enabled?: boolean, fields: { <key>: <value> } }
 * Partial: a blank/omitted secret field keeps the stored value (so the admin
 * never has to re-enter secrets just to flip `enabled` or tweak one field).
 */
export async function updatePaymentGateway(req, res) {
  const gateway = (req.params.gateway ?? "").toLowerCase();
  if (!GATEWAY_SPECS[gateway]) return res.status(404).json({ message: "بوابة دفع غير معروفة." });

  const incoming = req.body?.fields ?? {};
  const validationError = validateGatewayFields(gateway, incoming);
  if (validationError) return res.status(400).json({ message: validationError });

  const stored = await readStoredFields(gateway);
  const merged = mergeGatewayFields(gateway, stored.fields, incoming);
  const enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : stored.enabled;

  // A gateway can't be enabled (it becomes user-selectable) until all its
  // required keys are present — otherwise checkout would offer a broken gateway.
  if (enabled) {
    const missing = missingRequiredFields(gateway, merged);
    if (missing.length) {
      return res.status(422).json({
        message: `لا يمكن تفعيل البوابة قبل تعبئة الحقول المطلوبة: ${missing.join("، ")}.`,
      });
    }
  }

  await saveGatewayConfig(gateway, merged, enabled, req.user.id);
  res.json({ message: "تم حفظ إعدادات البوابة بنجاح.", gateway: presentGateway(gateway) });
}

/** DELETE /api/admin/payment-gateways/:gateway — clear DB config (revert to env). */
export async function deletePaymentGateway(req, res) {
  const gateway = (req.params.gateway ?? "").toLowerCase();
  if (!GATEWAY_SPECS[gateway]) return res.status(404).json({ message: "بوابة دفع غير معروفة." });
  await deleteGatewayConfig(gateway);
  res.json({ message: "تمت إعادة البوابة إلى الإعداد الافتراضي.", gateway: presentGateway(gateway) });
}
