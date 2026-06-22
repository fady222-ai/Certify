/**
 * Organization-role guards. `requireAuth` must run first (sets req.membershipRole).
 * Used to keep team "member" accounts out of owner-only actions (e.g. billing).
 */
export function requireOwner(req, res, next) {
  if (req.membershipRole !== "owner") {
    return res.status(403).json({ message: "هذا الإجراء متاح لمالك المنظمة فقط." });
  }
  next();
}
