/**
 * Builds the certificate HTML (A4 landscape, RTL Arabic). Chrome renders
 * Arabic shaping natively, so the output is pixel-perfect.
 *
 * @param {object} ctx
 * @param {string} ctx.orgName
 * @param {string} ctx.recipientName
 * @param {string|null} ctx.courseName
 * @param {string} ctx.issueDateLabel
 * @param {string} ctx.verificationCode
 * @param {string} ctx.qrSvg            inline <svg> for the verify URL
 * @param {string} ctx.primaryColor
 * @param {string|null} ctx.logoUrl
 * @param {string|null} ctx.signatureUrl
 */
export function certificateHtml(ctx) {
  const {
    orgName,
    recipientName,
    courseName,
    issueDateLabel,
    verificationCode,
    qrSvg,
    primaryColor = "#4f46e5",
    logoUrl,
    signatureUrl,
  } = ctx;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 1123px; height: 794px; overflow: hidden;
    font-family: "Cairo", "Noto Sans Arabic", "Arial", sans-serif;
    direction: rtl; text-align: right;
  }
  .certificate {
    position: relative; width: 100%; height: 100%;
    background: #ffffff; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: 60px 80px;
  }
  .border-outer { position: absolute; inset: 20px; border: 3px solid ${primaryColor}; }
  .border-inner { position: absolute; inset: 28px; border: 1px solid ${primaryColor}44; }
  .corner { position: absolute; width: 40px; height: 40px; border-color: ${primaryColor}; border-style: solid; }
  .corner.tl { top: 14px; right: 14px; border-width: 4px 0 0 4px; transform: scaleX(-1); }
  .corner.tr { top: 14px; left: 14px; border-width: 4px 4px 0 0; transform: scaleX(-1); }
  .corner.bl { bottom: 14px; right: 14px; border-width: 0 0 4px 4px; transform: scaleX(-1); }
  .corner.br { bottom: 14px; left: 14px; border-width: 0 4px 4px 0; transform: scaleX(-1); }
  .accent-bar { width: 120px; height: 5px; background: linear-gradient(90deg, ${primaryColor}, ${primaryColor}88); border-radius: 3px; margin-bottom: 24px; }
  .logo-wrap { margin-bottom: 18px; }
  .logo-wrap img { max-height: 60px; max-width: 180px; object-fit: contain; }
  .org-name-only { font-size: 16px; font-weight: 700; color: ${primaryColor}; letter-spacing: 2px; text-transform: uppercase; }
  .heading { font-size: 13px; font-weight: 600; color: #6b7280; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 8px; }
  .cert-title { font-size: 38px; font-weight: 800; color: #111827; margin-bottom: 20px; }
  .presented-to { font-size: 14px; color: #6b7280; margin-bottom: 14px; }
  .recipient-name { font-size: 42px; font-weight: 800; color: ${primaryColor}; margin-bottom: 20px; line-height: 1.2; text-align: center; }
  .course-line { font-size: 14px; color: #374151; margin-bottom: 6px; text-align: center; }
  .course-name { font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 28px; text-align: center; }
  .divider { width: 80%; height: 1px; background: #e5e7eb; margin-bottom: 24px; }
  .footer-row { display: flex; align-items: flex-start; justify-content: space-between; width: 80%; }
  .sig-block { text-align: center; min-width: 140px; }
  .sig-block img { max-height: 52px; max-width: 120px; margin-bottom: 6px; object-fit: contain; }
  .sig-line { width: 120px; height: 1px; background: #9ca3af; margin: 6px auto; }
  .sig-label, .date-label { font-size: 11px; color: #6b7280; }
  .date-block { text-align: center; }
  .date-label { margin-bottom: 4px; }
  .date-value { font-size: 13px; font-weight: 600; color: #374151; }
  .qr-block { text-align: center; }
  .qr-block svg { width: 80px; height: 80px; }
  .verify-label { font-size: 10px; color: #9ca3af; margin-top: 4px; }
  .verify-code { position: absolute; bottom: 34px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #9ca3af; letter-spacing: 2px; font-family: monospace; }
</style>
</head>
<body>
<div class="certificate">
  <div class="border-outer"></div>
  <div class="border-inner"></div>
  <div class="corner tl"></div><div class="corner tr"></div>
  <div class="corner bl"></div><div class="corner br"></div>

  <div class="logo-wrap">
    ${logoUrl ? `<img src="${logoUrl}" alt="${escapeHtml(orgName)}">` : `<div class="org-name-only">${escapeHtml(orgName)}</div>`}
  </div>

  <div class="accent-bar"></div>
  <div class="heading">Certificate of Completion</div>
  <h1 class="cert-title">شهادة إتمام</h1>
  <p class="presented-to">تشهد هذه المنصة بأن المتدرب / المتدربة</p>

  <div class="recipient-name">${escapeHtml(recipientName)}</div>

  ${courseName ? `<p class="course-line">قد أتمّ بنجاح دورة</p><p class="course-name">${escapeHtml(courseName)}</p>` : ""}

  <div class="divider"></div>

  <div class="footer-row">
    <div class="sig-block">
      ${signatureUrl ? `<img src="${signatureUrl}" alt="توقيع">` : ""}
      <div class="sig-line"></div>
      <div class="sig-label">توقيع المُصدر</div>
    </div>
    <div class="date-block">
      <div class="date-label">تاريخ الإصدار</div>
      <div class="date-value">${escapeHtml(issueDateLabel)}</div>
    </div>
    <div class="qr-block">
      ${qrSvg}
      <div class="verify-label">تحقق من الشهادة</div>
    </div>
  </div>

  <div class="verify-code">${escapeHtml(verificationCode)}</div>
</div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
