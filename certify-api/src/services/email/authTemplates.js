import { e, shell, btn, isEn } from "./emailI18n.js";

export function otpEmail({ userName, code, expiresMinutes = 15, locale = "ar" }) {
  const en = isEn(locale);
  const subject = en
    ? `${code} — your Certify verification code`
    : `${code} — رمز التحقق في Certify`;

  const content = en
    ? `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">✉️</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">Verify your email</h1>
      <p style="margin:0;font-size:14px;color:#6b7280;">Hi ${e(userName)} 👋</p>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 20px;">
      Use the code below to activate your account. It's valid for <strong>${expiresMinutes} minutes</strong>.
    </p>
    <div style="background:#f0f4ff;border:2px dashed #a5b4fc;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
      <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:12px;color:#4f46e5;font-family:monospace;">${e(code)}</p>
    </div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
      If you didn't request this code, you can safely ignore this email.
    </p>`
    : `
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
    </p>`;

  const text = en
    ? [
        `Hi ${userName},`,
        `Your verification code is: ${code}`,
        `It's valid for ${expiresMinutes} minutes.`,
        "If you didn't request this code, ignore this email.",
      ].join("\n")
    : [
        `مرحباً ${userName}،`,
        `رمز التحقق الخاص بك هو: ${code}`,
        `الرمز صالح لمدة ${expiresMinutes} دقيقة.`,
        "إن لم تطلب هذا الرمز، تجاهل هذه الرسالة.",
      ].join("\n");

  return { subject, html: shell(content, locale), text };
}

export function passwordResetEmail({ userName, resetUrl, expiresHours = 1, locale = "ar" }) {
  const en = isEn(locale);
  const subject = en ? "Reset your password — Certify" : "استعادة كلمة المرور — Certify";

  const content = en
    ? `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">🔐</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">Reset your password</h1>
      <p style="margin:0;font-size:14px;color:#6b7280;">Hi ${e(userName)} 👋</p>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      We received a request to reset your Certify account password.
      Click the button below to create a new password. The link is valid for <strong>${expiresHours} hour(s)</strong>.
    </p>
    <div style="text-align:center;margin-bottom:24px;">${btn("Reset password", resetUrl, "#7c3aed")}</div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
      If you didn't request this, ignore the email — your password won't change.
    </p>`
    : `
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
    </p>`;

  const text = en
    ? [
        `Hi ${userName},`,
        "We received a request to reset your account password.",
        `Reset link (valid ${expiresHours}h): ${resetUrl}`,
        "If you didn't request this, ignore the email.",
      ].join("\n")
    : [
        `مرحباً ${userName}،`,
        "تلقينا طلباً لإعادة تعيين كلمة مرور حسابك.",
        `رابط الاستعادة (صالح ${expiresHours} ساعة): ${resetUrl}`,
        "إن لم تطلب هذا، تجاهل الرسالة.",
      ].join("\n");

  return { subject, html: shell(content, locale), text };
}
