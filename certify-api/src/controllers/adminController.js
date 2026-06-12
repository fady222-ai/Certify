import { prisma } from "../db/prisma.js";

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

  const [totalOrgs, totalUsers, totalCerts, monthUsage, recentOrgs] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.certificate.count(),
    prisma.certificateUsage.aggregate({
      where: { month },
      _sum: { certificatesIssued: true },
    }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { owner: { select: { name: true, email: true } }, plan: true },
    }),
  ]);

  const recentCertTotals = await Promise.all(
    recentOrgs.map((o) => prisma.certificate.count({ where: { organizationId: o.id } }))
  );

  res.json({
    total_organizations: totalOrgs,
    total_users: totalUsers,
    total_certificates: totalCerts,
    certificates_this_month: monthUsage._sum.certificatesIssued ?? 0,
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
