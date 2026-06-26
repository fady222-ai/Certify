// Shared helpers for bilingual (Arabic/English) transactional emails.
// Recipient locale is threaded from User.locale (or the request locale at
// registration). Anything other than "en" falls back to Arabic (the default).

export function isEn(locale) {
  return locale === "en";
}

/** HTML-escape (shared by all template files). */
export function e(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const BRAND = "#4f46e5";

/**
 * Branded outer shell. `locale` sets dir/lang and the footer tagline so the
 * whole message reads correctly in either language.
 */
export function shell(content, locale) {
  const en = isEn(locale);
  const sub = en ? "Digital certificate platform" : "منصة الشهادات الرقمية";
  const foot = en ? "Certify — digital certificate platform" : "Certify — منصة الشهادات الرقمية";
  return `<!DOCTYPE html>
<html dir="${en ? "ltr" : "rtl"}" lang="${en ? "en" : "ar"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(2,6,23,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,${BRAND},${BRAND}cc);padding:22px 32px;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:800;">Certify</p>
            <p style="margin:4px 0 0;color:#c7d2fe;font-size:12px;">${sub}</p>
          </td>
        </tr>
        <tr><td style="padding:36px 32px;">${content}</td></tr>
        <tr>
          <td style="padding:16px 32px;background:#f8fafc;text-align:center;border-top:1px solid #eef2f7;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">${foot}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function btn(label, url, bg = BRAND) {
  return `<a href="${url}" style="display:inline-block;padding:13px 28px;background:${bg};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">${label}</a>`;
}
