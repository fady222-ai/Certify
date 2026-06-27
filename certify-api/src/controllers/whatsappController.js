import { isWhatsappEnabledPlatform, setWhatsappEnabledPlatform } from "../services/platformSettings.js";
import {
  presentOrgWhatsapp,
  validateWhatsappFields,
  mergeWhatsappFields,
  missingRequiredFields,
  readStoredFields,
  saveWhatsappConfig,
} from "../services/whatsappConfig.js";

// ── Platform admin: the global WhatsApp feature flag ─────────────────────────

/** GET /api/admin/whatsapp — current platform-wide WhatsApp flag. */
export async function adminGetWhatsapp(_req, res) {
  res.json({ enabled: isWhatsappEnabledPlatform() });
}

/** PUT /api/admin/whatsapp — toggle the platform-wide WhatsApp feature. */
export async function adminSetWhatsapp(req, res) {
  if (typeof req.body?.enabled !== "boolean") {
    return res.status(400).json({ message: "enabled (boolean) is required." });
  }
  await setWhatsappEnabledPlatform(req.body.enabled);
  res.json({ message: "تم تحديث حالة ميزة واتساب.", enabled: isWhatsappEnabledPlatform() });
}

// ── Organization owner: per-org credentials + on/off ─────────────────────────

/** GET /api/whatsapp — masked WhatsApp config for the owner's org. */
export async function getOrgWhatsapp(req, res) {
  res.json({
    ...presentOrgWhatsapp(req.organization.id),
    plan_allowed: !!req.organization.plan?.hasWhatsapp,
  });
}

/**
 * PUT /api/whatsapp — set/update the org's WhatsApp credentials and on/off.
 * Body: { enabled?: boolean, fields?: { <key>: <value> } }
 * Partial: a blank/omitted secret keeps the stored value.
 */
export async function updateOrgWhatsapp(req, res) {
  const orgId = req.organization.id;

  // The org can't enable WhatsApp while the platform feature is off, or on a
  // plan that doesn't include it (paid feature).
  const wantsEnable = req.body?.enabled === true;
  if (wantsEnable && !isWhatsappEnabledPlatform()) {
    return res.status(403).json({ message: "ميزة واتساب غير مفعّلة من إدارة المنصة." });
  }
  if (wantsEnable && !req.organization.plan?.hasWhatsapp) {
    return res.status(403).json({ message: "ميزة واتساب متاحة في باقتي Pro وBusiness. رقِّ باقتك لتفعيلها." });
  }

  const incoming = req.body?.fields ?? {};
  const validationError = validateWhatsappFields(incoming);
  if (validationError) return res.status(400).json({ message: validationError });

  const stored = await readStoredFields(orgId);
  const merged = mergeWhatsappFields(stored.fields, incoming);
  const enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : stored.enabled;

  // Can't enable until the required credentials are present.
  if (enabled) {
    const missing = missingRequiredFields(merged);
    if (missing.length) {
      return res.status(422).json({
        message: `لا يمكن التفعيل قبل تعبئة الحقول المطلوبة: ${missing.join("، ")}.`,
      });
    }
  }

  await saveWhatsappConfig(orgId, merged, enabled, req.user.id);
  res.json({
    message: "تم حفظ إعدادات واتساب بنجاح.",
    config: { ...presentOrgWhatsapp(orgId), plan_allowed: !!req.organization.plan?.hasWhatsapp },
  });
}
