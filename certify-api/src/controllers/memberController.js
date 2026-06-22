import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../services/authService.js";

const createSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب.").max(120),
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صالح."),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل."),
  role: z.enum(["admin", "member"]).default("member"),
  // Per-member monthly issuance cap is mandatory (owner decision): no member
  // account may exist without a defined quota.
  monthlyLimit: z.number({ required_error: "حدّ الإصدار الشهري مطلوب." }).int().positive("حدّ الإصدار الشهري مطلوب."),
});

// PATCH may update the role and/or the monthly limit.
const updateSchema = z.object({
  role: z.enum(["admin", "member"]).optional(),
  monthlyLimit: z.number().int().positive().optional(),
}).refine((d) => d.role !== undefined || d.monthlyLimit !== undefined, {
  message: "لا تغييرات.",
});

function presentMember(m, usedThisMonth = 0) {
  return {
    id: m.id,
    user_id: m.userId,
    name: m.user?.name ?? null,
    email: m.user?.email ?? null,
    role: m.role,
    is_owner: m.role === "owner",
    monthly_limit: m.monthlyLimit ?? null,
    used_this_month: usedThisMonth,
    joined_at: m.joinedAt,
  };
}

/** First instant of the current month (UTC) — matches the issuer's accounting. */
function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Only the owner or an admin may manage team members. */
function canManage(req) {
  return req.membershipRole === "owner" || req.membershipRole === "admin";
}

/** GET /api/members — list the organization's team members. */
export async function listMembers(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: req.organization.id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });

  // Per-member issuance this month → { userId: count } (one grouped query).
  const grouped = await prisma.certificate.groupBy({
    by: ["issuedById"],
    where: { organizationId: req.organization.id, createdAt: { gte: monthStart() } },
    _count: { _all: true },
  });
  const usedByUser = new Map(grouped.map((g) => [g.issuedById, g._count._all]));

  res.json({
    data: members.map((m) => presentMember(m, usedByUser.get(m.userId) ?? 0)),
    can_manage: canManage(req),
    limit: req.organization.plan?.teamMembersLimit ?? 1,
  });
}

/** POST /api/members — owner/admin creates a team member account. */
export async function createMember(req, res, next) {
  try {
    if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
    if (!canManage(req)) return res.status(403).json({ message: "لا تملك صلاحية إدارة الأعضاء." });

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ message: parsed.error.issues[0]?.message ?? "بيانات غير صالحة." });
    }
    const { name, email, password, role, monthlyLimit } = parsed.data;

    // A member's monthly cap can't exceed the academy's own monthly quota.
    const planQuota = req.organization.plan?.certificatesPerMonth ?? null;
    if (planQuota != null && monthlyLimit > planQuota) {
      return res.status(422).json({ message: `حدّ العضو لا يمكن أن يتجاوز حصّة الأكاديمية (${planQuota}).` });
    }

    // Enforce the plan's team-member limit (the owner counts as one member).
    const limit = req.organization.plan?.teamMembersLimit ?? 1;
    const count = await prisma.organizationMember.count({ where: { organizationId: req.organization.id } });
    if (count >= limit) {
      return res.status(403).json({ message: "وصلت إلى الحد الأقصى لأعضاء الفريق في باقتك. قم بترقية الباقة." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "هذا البريد الإلكتروني مستخدم بالفعل." });
    }

    const passwordHash = await hashPassword(password);
    const member = await prisma.$transaction(async (tx) => {
      // Owner-vouched account: email is pre-verified so the member logs in at once.
      const u = await tx.user.create({
        data: { name, email, passwordHash, emailVerified: true },
      });
      return tx.organizationMember.create({
        data: { organizationId: req.organization.id, userId: u.id, role, monthlyLimit },
        include: { user: { select: { name: true, email: true } } },
      });
    });

    res.status(201).json(presentMember(member));
  } catch (e) {
    next(e);
  }
}

/** PATCH /api/members/:id — change a member's role and/or monthly limit (owner only). */
export async function updateMemberRole(req, res, next) {
  try {
    if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
    if (req.membershipRole !== "owner") {
      return res.status(403).json({ message: "تعديل الأعضاء صلاحية المالك فقط." });
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ message: parsed.error.issues[0]?.message ?? "بيانات غير صالحة." });

    const planQuota = req.organization.plan?.certificatesPerMonth ?? null;
    if (parsed.data.monthlyLimit != null && planQuota != null && parsed.data.monthlyLimit > planQuota) {
      return res.status(422).json({ message: `حدّ العضو لا يمكن أن يتجاوز حصّة الأكاديمية (${planQuota}).` });
    }

    const member = await prisma.organizationMember.findFirst({
      where: { id: req.params.id, organizationId: req.organization.id },
    });
    if (!member) return res.status(404).json({ message: "العضو غير موجود." });
    if (member.role === "owner") return res.status(409).json({ message: "لا يمكن تعديل صفّ المالك." });

    const data = {};
    if (parsed.data.role !== undefined) data.role = parsed.data.role;
    if (parsed.data.monthlyLimit !== undefined) data.monthlyLimit = parsed.data.monthlyLimit;

    const updated = await prisma.organizationMember.update({
      where: { id: member.id },
      data,
      include: { user: { select: { name: true, email: true } } },
    });
    res.json(presentMember(updated));
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/members/:id — remove a member (owner/admin). Deletes their account. */
export async function deleteMember(req, res, next) {
  try {
    if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
    if (!canManage(req)) return res.status(403).json({ message: "لا تملك صلاحية إدارة الأعضاء." });

    const member = await prisma.organizationMember.findFirst({
      where: { id: req.params.id, organizationId: req.organization.id },
    });
    if (!member) return res.status(404).json({ message: "العضو غير موجود." });
    if (member.role === "owner") return res.status(409).json({ message: "لا يمكن إزالة مالك المنظمة." });

    // Remove the membership and the (org-only) user account it created.
    await prisma.$transaction([
      prisma.organizationMember.delete({ where: { id: member.id } }),
      prisma.user.delete({ where: { id: member.userId } }),
    ]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
