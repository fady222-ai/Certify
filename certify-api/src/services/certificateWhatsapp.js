import { config } from "../config/index.js";
import { verifyUrl } from "./certificateRenderer.js";
import { logCertificateEvent } from "./certificateEvents.js";
import { isWhatsappAvailableForOrg, whatsappCredentials } from "./whatsappConfig.js";

const GRAPH_VERSION = "v21.0";

function pdfAbsoluteUrl(pdfUrl) {
  if (!pdfUrl) return null;
  if (/^https?:\/\//i.test(pdfUrl)) return pdfUrl;
  return `${config.appUrl.replace(/\/$/, "")}/storage/${pdfUrl}`;
}

/** WhatsApp wants digits only, including country code (no +, spaces, dashes). */
function normalizePhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/**
 * Deliver the certificate to its recipient over WhatsApp (best-effort, never
 * throws). Sends an approved template message via the org's Meta WhatsApp Cloud
 * API credentials. Only runs when the feature is available for the org AND the
 * recipient has a usable phone number. Logs a "whatsapped" event on success.
 *
 * @param {object} cert  certificate record (with organizationId + recipientPhone)
 */
export async function sendCertificateWhatsapp(cert) {
  const orgId = cert?.organizationId ?? cert?.organization?.id ?? null;
  if (!orgId) return { ok: false, transport: "none", error: "no organization" };
  if (!isWhatsappAvailableForOrg(orgId)) return { ok: false, transport: "disabled" };

  const to = normalizePhone(cert.recipientPhone);
  if (!to) return { ok: false, transport: "none", error: "no recipient phone" };

  const { phoneNumberId, accessToken, templateName, languageCode } = whatsappCredentials(orgId);
  const pdfUrl = pdfAbsoluteUrl(cert.pdfUrl);
  const link = verifyUrl(cert.verificationCode);

  // Template body params (order must match the org's approved template):
  //   {{1}} recipient name · {{2}} course name · {{3}} verification link
  const bodyParams = [
    { type: "text", text: cert.recipientName ?? "" },
    { type: "text", text: cert.courseName ?? "-" },
    { type: "text", text: link },
  ];
  const components = [];
  if (pdfUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "document", document: { link: pdfUrl, filename: "certificate.pdf" } }],
    });
  }
  components.push({ type: "body", parameters: bodyParams });

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name: templateName, language: { code: languageCode }, components },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message ?? `HTTP ${res.status}`;
      console.error(`[whatsapp] send failed for ${cert.verificationCode}:`, msg);
      return { ok: false, transport: "whatsapp", error: msg };
    }
    const id = data?.messages?.[0]?.id ?? null;
    logCertificateEvent(cert.id, "whatsapped", {
      metadata: JSON.stringify({ transport: "whatsapp", id }),
    }).catch(() => {});
    return { ok: true, transport: "whatsapp", id };
  } catch (err) {
    console.error(`[whatsapp] request failed for ${cert.verificationCode}:`, err.message);
    return { ok: false, transport: "whatsapp", error: err.message };
  }
}
