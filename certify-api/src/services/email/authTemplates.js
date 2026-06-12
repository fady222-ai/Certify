function e(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BRAND = "#4f46e5";

function shell(content) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(2,6,23,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,${BRAND},${BRAND}cc);padding:22px 32px;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:800;">Certify</p>
            <p style="margin:4px 0 0;color:#c7d2fe;font-size:12px;">منصة الشهادات الرقمية</p>
          </td>
        </tr>
        <tr><td style="padding:36px 32px;">${content}</td></tr>
        <tr>
          <td style="padding:16px 32px;background:#f8fafc;text-align:center;border-top:1px solid #eef2f7;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">Certify — منصة الشهادات الرقمية</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function btn(label, url, bg = BRAND) {
  return `<a href="${url}" style="display:inline-block;padding:13px 28px;background:${bg};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">${label}</a>`;
}

export function otpEmail({ userName, code, expiresMinutes = 15 }) {
  const subject = `${code} — رمز التحقق في Certify`;

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">✉️</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">تحقق من بريدك الإلكتروني</h1>
      <p style="margin:0;font-size:14px;color:#6b7280;">مرحباً ${e(userName)} 👋</p>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 20px;">
      استخدم الرمز التالي لتفعيل حسابك. الرمز صالح لمدة <strong>${expiresMinutes} دقيقة</strong>.
    </p>
    <div style="background:#f0f4ff;border:2px dashed #a5b4fc;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
      <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:12px;color:#4f46e5;font-family:monospace;">${e(code)}</p>
    </div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
      إن لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.
    </p>
  `;

  return {
    subject,
    html: shell(content),
    text: [
      `مرحباً ${userName}،`,
      `رمز التحقق الخاص بك هو: ${code}`,
      `الرمز صالح لمدة ${expiresMinutes} دقيقة.`,
      "إن لم تطلب هذا الرمز، تجاهل هذه الرسالة.",
    ].join("\n"),
  };
}

export function passwordResetEmail({ userName, resetUrl, expiresHours = 1 }) {
  const subject = "استعادة كلمة المرور — Certify";

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">🔐</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">استعادة كلمة المرور</h1>
      <p style="margin:0;font-size:14px;color:#6b7280;">مرحباً ${e(userName)} 👋</p>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      تلقينا طلباً لإعادة تعيين كلمة مرور حسابك في Certify.
      اضغط على الزر أدناه لإنشاء كلمة مرور جديدة. الرابط صالح لمدة <strong>${expiresHours} ساعة</strong>.
    </p>
    <div style="text-align:center;margin-bottom:24px;">${btn("إعادة تعيين كلمة المرور", resetUrl, "#7c3aed")}</div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
      إن لم تطلب هذا، تجاهل الرسالة — كلمة مرورك لن تتغير.
    </p>
  `;

  return {
    subject,
    html: shell(content),
    text: [
      `مرحباً ${userName}،`,
      "تلقينا طلباً لإعادة تعيين كلمة مرور حسابك.",
      `رابط الاستعادة (صالح ${expiresHours} ساعة): ${resetUrl}`,
      "إن لم تطلب هذا، تجاهل الرسالة.",
    ].join("\n"),
  };
}
