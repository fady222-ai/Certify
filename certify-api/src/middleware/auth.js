import { prisma } from "../db/prisma.js";
import { verifyToken } from "../services/authService.js";

/**
 * Requires a valid Bearer token. Loads the user and their primary organization
 * onto req.user / req.organization for downstream handlers.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: "مطلوب تسجيل الدخول." });
    }

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return res.status(401).json({ message: "الجلسة غير صالحة." });
    }

    // Token revocation check — logout invalidates all tokens issued before tokenRevokedAt
    if (user.tokenRevokedAt && payload.iat * 1000 <= user.tokenRevokedAt.getTime()) {
      return res.status(401).json({ message: "انتهت الجلسة. يرجى تسجيل الدخول مجدداً." });
    }

    const organization = await prisma.organization.findFirst({
      where: { ownerId: user.id },
      include: { plan: true },
      orderBy: { createdAt: "asc" },
    });

    if (organization?.suspendedAt) {
      return res.status(403).json({ message: "هذا الحساب موقوف. تواصل مع الدعم." });
    }

    req.user = user;
    req.organization = organization;
    next();
  } catch {
    return res.status(401).json({ message: "الجلسة منتهية أو غير صالحة." });
  }
}
