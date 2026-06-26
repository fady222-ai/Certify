import { e as escapeHtml, isEn } from "./emailI18n.js";

/**
 * Certificate-issued email (bilingual). `locale` follows the issuing academy's
 * preference (the org owner's locale).
 *
 * @param {object} ctx
 * @param {string} ctx.recipientName
 * @param {string|null} ctx.courseName
 * @param {string} ctx.orgName
 * @param {string} ctx.verifyUrl
 * @param {string|null} ctx.pdfUrl
 * @param {string} ctx.primaryColor
 * @param {string} [ctx.locale]
 * @returns {{ subject: string, html: string, text: string }}
 */
export function certificateEmail(ctx) {
  const {
    recipientName,
    courseName,
    orgName,
    verifyUrl,
    pdfUrl,
    primaryColor = "#4f46e5",
    locale = "ar",
  } = ctx;
  const en = isEn(locale);

  const subject = en
    ? (courseName ? `🎓 Your certificate in "${courseName}" from ${orgName}` : `🎓 Your certificate from ${orgName}`)
    : (courseName ? `🎓 شهادتك في «${courseName}» من ${orgName}` : `🎓 شهادتك من ${orgName}`);

  const courseLine = en
    ? (courseName
        ? `<p style="margin:0 0 6px;font-size:14px;color:#6b7280;">For successfully completing</p>
           <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#1f2937;">${escapeHtml(courseName)}</p>`
        : `<p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Congratulations on your achievement.</p>`)
    : (courseName
        ? `<p style="margin:0 0 6px;font-size:14px;color:#6b7280;">لإتمامك بنجاح دورة</p>
           <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#1f2937;">${escapeHtml(courseName)}</p>`
        : `<p style="margin:0 0 24px;font-size:14px;color:#6b7280;">تهانينا على إنجازك.</p>`);

  const pdfLabel = en ? "Download certificate (PDF)" : "تحميل الشهادة (PDF)";
  const verifyLabel = en ? "Verification page" : "صفحة التحقق";
  const congrats = en ? `Congratulations ${escapeHtml(recipientName)}!` : `مبارك ${escapeHtml(recipientName)}!`;
  const intro = en
    ? "Your verified digital certificate has been issued. You can download it or verify its authenticity via the official link."
    : "تم إصدار شهادتك الرقمية الموثّقة. يمكنك تحميلها أو التحقق من صحتها عبر الرابط الرسمي.";
  const footerNote = en
    ? `Verified with an encrypted digital fingerprint · ${escapeHtml(orgName)}`
    : `شهادة موثّقة ببصمة رقمية مشفّرة · ${escapeHtml(orgName)}`;

  const pdfButton = pdfUrl
    ? `<a href="${pdfUrl}" style="display:inline-block;margin:0 6px;padding:12px 22px;background:${primaryColor};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">${pdfLabel}</a>`
    : "";

  const html = `<!DOCTYPE html>
<html dir="${en ? "ltr" : "rtl"}" lang="${en ? "en" : "ar"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(2,6,23,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,${primaryColor},${primaryColor}cc);padding:28px 32px;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:800;">${escapeHtml(orgName)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;text-align:center;">
            <div style="font-size:44px;line-height:1;margin-bottom:14px;">🎓</div>
            <h1 style="margin:0 0 18px;font-size:22px;color:#111827;">${congrats}</h1>
            ${courseLine}
            <p style="margin:0 0 26px;font-size:14px;color:#374151;line-height:1.8;">
              ${intro}
            </p>
            <div style="margin:0 0 8px;">
              ${pdfButton}
              <a href="${verifyUrl}" style="display:inline-block;margin:0 6px;padding:12px 22px;background:#ffffff;color:${primaryColor};text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;border:1px solid ${primaryColor}55;">${verifyLabel}</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px;background:#f8fafc;text-align:center;border-top:1px solid #eef2f7;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              ${footerNote}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = (en
    ? [
        `Congratulations ${recipientName}!`,
        courseName ? `For completing: ${courseName}` : "Congratulations on your achievement.",
        pdfUrl ? `Download certificate: ${pdfUrl}` : "",
        `Verify the certificate: ${verifyUrl}`,
        `— ${orgName}`,
      ]
    : [
        `مبارك ${recipientName}!`,
        courseName ? `لإتمامك دورة: ${courseName}` : "تهانينا على إنجازك.",
        pdfUrl ? `تحميل الشهادة: ${pdfUrl}` : "",
        `التحقق من الشهادة: ${verifyUrl}`,
        `— ${orgName}`,
      ])
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
