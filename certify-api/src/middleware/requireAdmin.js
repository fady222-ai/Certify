import { config } from "../config/index.js";

/**
 * Must run after requireAuth. Allows only the account whose email matches
 * the ADMIN_EMAIL environment variable — the platform super-admin.
 */
export function requireAdmin(req, res, next) {
  if (!config.adminEmail) {
    return res.status(503).json({ message: "لم يُضبط بريد المدير (ADMIN_EMAIL)." });
  }
  if (req.user?.email?.toLowerCase() !== config.adminEmail) {
    return res.status(403).json({ message: "غير مصرح." });
  }
  next();
}
