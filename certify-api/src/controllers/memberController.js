import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../services/authService.js";

const createSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب.").max(120),
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صالح."),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل."),
  role: z.enum(["admin", "member"]).default("member"),
});

const roleSchema = z.object({ role: z.enum(["admin", "member"]) });

function presentMember(m) {
  return {
    id: m.id,
    user_id: m.userId,
    name: m.user?.name ?? null,
    email: m.user?.email ?? null,
    role: m.role,
    is_owner: m.role === "owner",
    joined_at: m.joinedAt,
  };
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
  res.json({
    data: members.map(presentMember),
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
    const { name, email, password, role } = parsed.data;

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
        data: { organizationId: req.organization.id, userId: u.id, role },
        include: { user: { select: { name: true, email: true } } },
      });
    });

    res.status(201).json(presentMember(member));
  } catch (e) {
    next(e);
  }
}

/** PATCH /api/members/:id — change a member's role (owner only). */
export async function updateMemberRole(req, res, next) {
  try {
    if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
    if (req.membershipRole !== "owner") {
      return res.status(403).json({ message: "تغيير الأدوار صلاحية المالك فقط." });
    }
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ message: "دور غير صالح." });

    const member = await prisma.organizationMember.findFirst({
      where: { id: req.params.id, organizationId: req.organization.id },
    });
    if (!member) return res.status(404).json({ message: "العضو غير موجود." });
    if (member.role === "owner") return res.status(409).json({ message: "لا يمكن تغيير دور المالك." });

    const updated = await prisma.organizationMember.update({
      where: { id: member.id },
      data: { role: parsed.data.role },
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
