import { e, shell, btn, isEn } from "./emailI18n.js";

const INTERVAL = {
  ar: { monthly: "شهري", annual: "سنوي" },
  en: { monthly: "monthly", annual: "annual" },
};
const CURRENCY_SYM = { USD: "$", EGP: "ج.م.", SAR: "ر.س." };

function fmt(amount, currency) {
  return `${CURRENCY_SYM[currency] ?? currency}${amount}`;
}

function fmtDate(d, locale) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(isEn(locale) ? "en-US" : "ar-EG", {
      year: "numeric", month: "long", day: "numeric", numberingSystem: "latn",
    });
  } catch {
    return String(d);
  }
}

function row(label, value) {
  return `<tr>
    <td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#6b7280;width:42%;">${label}</td>
    <td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#111827;font-weight:600;">${value}</td>
  </tr>`;
}

/** Payment receipt — sent after first activation OR auto-renewal. */
export function paymentReceiptEmail({ userName, planName, amount, currency, interval, gateway, periodEnd, webUrl, isRenewal = false, locale = "ar" }) {
  const en = isEn(locale);
  const emoji = isRenewal ? "🔄" : "🎉";
  const intervalLabel = (INTERVAL[en ? "en" : "ar"])[interval] ?? interval;

  const headline = en
    ? (isRenewal ? "Your subscription was renewed" : "Your subscription is active")
    : (isRenewal ? "تم تجديد اشتراكك" : "تم تفعيل اشتراكك");
  const subject = en
    ? (isRenewal ? `✅ Your Certify subscription was renewed — ${planName} plan` : `✅ Welcome to the ${planName} plan on Certify`)
    : (isRenewal ? `✅ تم تجديد اشتراكك في Certify — باقة ${planName}` : `✅ مرحباً بك في باقة ${planName} على Certify`);
  const hi = en ? `Hi ${e(userName)} 👋` : `مرحباً ${e(userName)} 👋`;
  const detailsHead = en ? "Subscription details" : "تفاصيل الاشتراك";
  const lPlan = en ? "Plan" : "الباقة";
  const lAmount = en ? "Amount" : "المبلغ";
  const lGateway = en ? "Payment gateway" : "بوابة الدفع";
  const lNext = en ? "Next renewal" : "التجديد القادم";
  const cta = en ? "Go to dashboard" : "الذهاب للوحة التحكم";

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">${emoji}</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${headline}</h1>
      <p style="margin:0;font-size:14px;color:#6b7280;">${hi}</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <tr><td colspan="2"
        style="padding:10px 14px;background:#f9fafb;font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:0.5px;">
        ${detailsHead}
      </td></tr>
      ${row(lPlan, e(planName))}
      ${row(lAmount, e(fmt(amount, currency)) + " / " + intervalLabel)}
      ${row(lGateway, e(gateway))}
      ${row(lNext, fmtDate(periodEnd, locale))}
    </table>
    <div style="text-align:center;">${btn(cta, webUrl + "/dashboard/billing")}</div>
  `;

  const text = (en
    ? [`Hi ${userName},`, `${headline} on the ${planName} plan.`, `Amount: ${fmt(amount, currency)} / ${intervalLabel}`, `Payment gateway: ${gateway}`, `Next renewal: ${fmtDate(periodEnd, locale)}`, "", webUrl + "/dashboard/billing"]
    : [`مرحباً ${userName}،`, `${headline} في باقة ${planName}.`, `المبلغ: ${fmt(amount, currency)} / ${intervalLabel}`, `بوابة الدفع: ${gateway}`, `التجديد القادم: ${fmtDate(periodEnd, locale)}`, "", webUrl + "/dashboard/billing"]
  ).join("\n");

  return { subject, html: shell(content, locale), text };
}

/** Renewal reminder — wallet users who must renew manually (no saved card). */
export function renewalReminderEmail({ userName, planName, daysLeft, periodEnd, webUrl, locale = "ar" }) {
  const en = isEn(locale);
  const subject = en
    ? `⏰ Your Certify subscription expires in ${daysLeft} day(s) — renew now`
    : `⏰ اشتراكك في Certify ينتهي خلال ${daysLeft} أيام — جدّده الآن`;
  const hi = en ? `Hi ${e(userName)} 👋` : `مرحباً ${e(userName)} 👋`;
  const title = en ? "Your subscription is about to expire" : "اشتراكك على وشك الانتهاء";
  const whenEn = daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
  const whenAr = daysLeft === 1 ? "غداً" : `خلال ${daysLeft} أيام`;
  const notice = en
    ? `Your <strong>${e(planName)}</strong> plan subscription will expire <strong>${whenEn}</strong> on <strong>${fmtDate(periodEnd, locale)}</strong>.`
    : `اشتراكك في باقة <strong>${e(planName)}</strong> سينتهي <strong>${whenAr}</strong> بتاريخ <strong>${fmtDate(periodEnd, locale)}</strong>.`;
  const body1 = en
    ? "Your current payment method (Vodafone Cash / InstaPay / Fawry) doesn't support automatic renewal. To keep issuing certificates, please pay again before the subscription expires."
    : "طريقة دفعك الحالية (فودافون كاش / إنستاباي / فوري) لا تدعم التجديد التلقائي. لمواصلة إصدار الشهادات يرجى الدفع مجدداً قبل انتهاء الاشتراك.";
  const body2 = en
    ? "You can also switch to a credit card to enable automatic renewal."
    : "يمكنك أيضاً التحويل لبطاقة ائتمانية لتفعيل التجديد التلقائي.";
  const cta = en ? "Renew now" : "جدّد الاشتراك الآن";

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">⏰</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${title}</h1>
      <p style="margin:0;font-size:14px;color:#6b7280;">${hi}</p>
    </div>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#92400e;line-height:1.7;">${notice}</p>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 8px;">${body1}</p>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">${body2}</p>
    <div style="text-align:center;">${btn(cta, webUrl + "/dashboard/billing", "#d97706")}</div>
  `;

  const text = (en
    ? [`Hi ${userName},`, `Your ${planName} plan subscription expires in ${daysLeft} day(s) (${fmtDate(periodEnd, locale)}).`, "Please renew manually — your payment method doesn't support auto-renewal.", "", webUrl + "/dashboard/billing"]
    : [`مرحباً ${userName}،`, `اشتراكك في باقة ${planName} سينتهي خلال ${daysLeft} يوم (${fmtDate(periodEnd, locale)}).`, "يرجى التجديد يدوياً لأن طريقة دفعك لا تدعم التجديد التلقائي.", "", webUrl + "/dashboard/billing"]
  ).join("\n");

  return { subject, html: shell(content, locale), text };
}

/** Payment failed — auto-renewal charge failed (Tap or Paymob card). */
export function paymentFailedEmail({ userName, planName, webUrl, locale = "ar" }) {
  const en = isEn(locale);
  const subject = en
    ? `⚠️ Couldn't renew your Certify subscription — ${planName} plan`
    : `⚠️ تعذّر تجديد اشتراكك في Certify — باقة ${planName}`;
  const hi = en ? `Hi ${e(userName)} 👋` : `مرحباً ${e(userName)} 👋`;
  const title = en ? "Subscription renewal failed" : "تعذّر تجديد الاشتراك";
  const notice = en
    ? `We tried to renew your <strong>${e(planName)}</strong> plan subscription automatically, but the payment didn't go through.`
    : `حاولنا تجديد اشتراكك في باقة <strong>${e(planName)}</strong> تلقائياً لكن الدفع لم ينجح.`;
  const body = en
    ? "To avoid an interruption to your service, please update your payment details or pay manually as soon as possible."
    : "لتجنّب انقطاع خدمتك يرجى تحديث بيانات الدفع أو إجراء الدفع يدوياً في أقرب وقت.";
  const cta = en ? "Update payment method" : "تحديث طريقة الدفع";

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">⚠️</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${title}</h1>
      <p style="margin:0;font-size:14px;color:#6b7280;">${hi}</p>
    </div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.7;">${notice}</p>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">${body}</p>
    <div style="text-align:center;">${btn(cta, webUrl + "/dashboard/billing", "#dc2626")}</div>
  `;

  const text = (en
    ? [`Hi ${userName},`, `We couldn't renew your ${planName} plan subscription automatically.`, "Please update your payment method or pay manually.", "", webUrl + "/dashboard/billing"]
    : [`مرحباً ${userName}،`, `تعذّر تجديد اشتراكك في باقة ${planName} تلقائياً.`, "يرجى تحديث طريقة الدفع أو الدفع يدوياً.", "", webUrl + "/dashboard/billing"]
  ).join("\n");

  return { subject, html: shell(content, locale), text };
}
