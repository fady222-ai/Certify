function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Arabic RTL certificate-issued email.
 *
 * @param {object} ctx
 * @param {string} ctx.recipientName
 * @param {string|null} ctx.courseName
 * @param {string} ctx.orgName
 * @param {string} ctx.verifyUrl
 * @param {string|null} ctx.pdfUrl
 * @param {string} ctx.primaryColor
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
  } = ctx;

  const subject = courseName
    ? `🎓 شهادتك في «${courseName}» من ${orgName}`
    : `🎓 شهادتك من ${orgName}`;

  const courseLine = courseName
    ? `<p style="margin:0 0 6px;font-size:14px;color:#6b7280;">لإتمامك بنجاح دورة</p>
       <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#1f2937;">${escapeHtml(courseName)}</p>`
    : `<p style="margin:0 0 24px;font-size:14px;color:#6b7280;">تهانينا على إنجازك.</p>`;

  const pdfButton = pdfUrl
    ? `<a href="${pdfUrl}" style="display:inline-block;margin:0 6px;padding:12px 22px;background:${primaryColor};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">تحميل الشهادة (PDF)</a>`
    : "";

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
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
            <h1 style="margin:0 0 18px;font-size:22px;color:#111827;">مبارك ${escapeHtml(recipientName)}!</h1>
            ${courseLine}
            <p style="margin:0 0 26px;font-size:14px;color:#374151;line-height:1.8;">
              تم إصدار شهادتك الرقمية الموثّقة. يمكنك تحميلها أو التحقق من صحتها عبر الرابط الرسمي.
            </p>
            <div style="margin:0 0 8px;">
              ${pdfButton}
              <a href="${verifyUrl}" style="display:inline-block;margin:0 6px;padding:12px 22px;background:#ffffff;color:${primaryColor};text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;border:1px solid ${primaryColor}55;">صفحة التحقق</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px;background:#f8fafc;text-align:center;border-top:1px solid #eef2f7;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              شهادة موثّقة ببصمة رقمية مشفّرة · ${escapeHtml(orgName)}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `مبارك ${recipientName}!`,
    courseName ? `لإتمامك دورة: ${courseName}` : "تهانينا على إنجازك.",
    pdfUrl ? `تحميل الشهادة: ${pdfUrl}` : "",
    `التحقق من الشهادة: ${verifyUrl}`,
    `— ${orgName}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
