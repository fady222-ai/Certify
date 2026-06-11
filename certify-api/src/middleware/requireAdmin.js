/**
 * Must run after requireAuth. Allows only accounts whose role is "admin"
 * (provisioned from ADMIN_EMAIL / ADMIN_PASSWORD). Role lives in the database,
 * so admin access can't be obtained through public registration.
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "غير مصرح." });
  }
  next();
}
