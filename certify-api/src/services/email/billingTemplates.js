function e(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BRAND = "#4f46e5";
const INTERVAL_AR = { monthly: "شهري", annual: "سنوي" };
const CURRENCY_SYM = { USD: "$", EGP: "ج.م.", SAR: "ر.س." };

function fmt(amount, currency) {
  return `${CURRENCY_SYM[currency] ?? currency}${amount}`;
}

function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return String(d); }
}

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

function row(label, value) {
  return `<tr>
    <td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#6b7280;width:42%;">${label}</td>
    <td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#111827;font-weight:600;">${value}</td>
  </tr>`;
}

/**
 * Payment receipt — sent after first activation OR auto-renewal.
 */
export function paymentReceiptEmail({ userName, planName, amount, currency, interval, gateway, periodEnd, webUrl, isRenewal = false }) {
  const emoji = isRenewal ? "🔄" : "🎉";
  const headline = isRenewal ? "تم تجديد اشتراكك" : "تم تفعيل اشتراكك";
  const subject = isRenewal
    ? `✅ تم تجديد اشتراكك في Certify — باقة ${planName}`
    : `✅ مرحباً بك في باقة ${planName} على Certify`;

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">${emoji}</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${headline}</h1>
      <p style="margin:0;font-size:14px;color:#6b7280;">مرحباً ${e(userName)} 👋</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <tr><td colspan="2"
        style="padding:10px 14px;background:#f9fafb;font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:0.5px;">
        تفاصيل الاشتراك
      </td></tr>
      ${row("الباقة", e(planName))}
      ${row("المبلغ", e(fmt(amount, currency)) + " / " + (INTERVAL_AR[interval] ?? interval))}
      ${row("بوابة الدفع", e(gateway))}
      ${row("التجديد القادم", fmtDate(periodEnd))}
    </table>
    <div style="text-align:center;">${btn("الذهاب للوحة التحكم", webUrl + "/dashboard/billing")}</div>
  `;

  return {
    subject,
    html: shell(content),
    text: [
      `مرحباً ${userName}،`,
      `${headline} في باقة ${planName}.`,
      `المبلغ: ${fmt(amount, currency)} / ${INTERVAL_AR[interval] ?? interval}`,
      `بوابة الدفع: ${gateway}`,
      `التجديد القادم: ${fmtDate(periodEnd)}`,
      "",
      webUrl + "/dashboard/billing",
    ].join("\n"),
  };
}

/**
 * Renewal reminder — for wallet users (Vodafone Cash / InstaPay / Fawry)
 * who need to renew manually since no card token is saved.
 */
export function renewalReminderEmail({ userName, planName, daysLeft, periodEnd, webUrl }) {
  const subject = `⏰ اشتراكك في Certify ينتهي خلال ${daysLeft} أيام — جدّده الآن`;

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">⏰</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">اشتراكك على وشك الانتهاء</h1>
      <p style="margin:0;font-size:14px;color:#6b7280;">مرحباً ${e(userName)} 👋</p>
    </div>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#92400e;line-height:1.7;">
        اشتراكك في باقة <strong>${e(planName)}</strong> سينتهي
        <strong>${daysLeft === 1 ? "غداً" : `خلال ${daysLeft} أيام`}</strong>
        بتاريخ <strong>${fmtDate(periodEnd)}</strong>.
      </p>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 8px;">
      طريقة دفعك الحالية (فودافون كاش / إنستاباي / فوري) لا تدعم التجديد
      التلقائي. لمواصلة إصدار الشهادات يرجى الدفع مجدداً قبل انتهاء الاشتراك.
    </p>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      يمكنك أيضاً التحويل لبطاقة ائتمانية لتفعيل التجديد التلقائي.
    </p>
    <div style="text-align:center;">${btn("جدّد الاشتراك الآن", webUrl + "/dashboard/billing", "#d97706")}</div>
  `;

  return {
    subject,
    html: shell(content),
    text: [
      `مرحباً ${userName}،`,
      `اشتراكك في باقة ${planName} سينتهي خلال ${daysLeft} يوم (${fmtDate(periodEnd)}).`,
      "يرجى التجديد يدوياً لأن طريقة دفعك لا تدعم التجديد التلقائي.",
      "",
      webUrl + "/dashboard/billing",
    ].join("\n"),
  };
}

/**
 * Payment failed — sent when auto-renewal charge fails (Tap or Paymob card).
 */
export function paymentFailedEmail({ userName, planName, webUrl }) {
  const subject = `⚠️ تعذّر تجديد اشتراكك في Certify — باقة ${planName}`;

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">⚠️</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">تعذّر تجديد الاشتراك</h1>
      <p style="margin:0;font-size:14px;color:#6b7280;">مرحباً ${e(userName)} 👋</p>
    </div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.7;">
        حاولنا تجديد اشتراكك في باقة <strong>${e(planName)}</strong>
        تلقائياً لكن الدفع لم ينجح.
      </p>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      لتجنّب انقطاع خدمتك يرجى تحديث بيانات الدفع أو إجراء الدفع يدوياً
      في أقرب وقت.
    </p>
    <div style="text-align:center;">${btn("تحديث طريقة الدفع", webUrl + "/dashboard/billing", "#dc2626")}</div>
  `;

  return {
    subject,
    html: shell(content),
    text: [
      `مرحباً ${userName}،`,
      `تعذّر تجديد اشتراكك في باقة ${planName} تلقائياً.`,
      "يرجى تحديث طريقة الدفع أو الدفع يدوياً.",
      "",
      webUrl + "/dashboard/billing",
    ].join("\n"),
  };
}
