// Email templates for the support ticket system (bilingual where the recipient
// is a known user). Admin-inbox notifications stay Arabic (the platform admin),
// and guest notifications default to Arabic (guests have no stored locale).

import { e, shell, btn, isEn } from "./emailI18n.js";

function head(emoji, title, sub) {
  return `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">${emoji}</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${e(title)}</h1>
      ${sub ? `<p style="margin:0;font-size:14px;color:#6b7280;">${e(sub)}</p>` : ""}
    </div>`;
}

function subjectLine(label, subject) {
  return `<p style="font-size:13px;color:#6b7280;background:#f8fafc;border:1px solid #eef2f7;border-radius:10px;padding:12px 16px;margin:0 0 24px;">
    <strong style="color:#374151;">${label}</strong> ${e(subject)}</p>`;
}

/** Sent to the admin inbox when ANY new ticket is opened (Arabic — platform admin). */
export function newTicketAdminEmail({ subject, requesterName, requesterEmail, adminUrl }) {
  const content = `
    ${head("📨", "تذكرة دعم جديدة", `من ${requesterName || requesterEmail || "زائر"}`)}
    ${subjectLine("الموضوع:", subject)}
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      وصلت تذكرة دعم جديدة وتنتظر ردّك. افتح لوحة التذاكر للاطّلاع والردّ.
    </p>
    <div style="text-align:center;">${btn("فتح لوحة التذاكر", adminUrl)}</div>`;
  return {
    subject: `تذكرة دعم جديدة — ${subject}`,
    html: shell(content, "ar"),
    text: `تذكرة دعم جديدة من ${requesterName || requesterEmail}\nالموضوع: ${subject}\n${adminUrl}`,
  };
}

/** Acknowledgement to an authenticated user after opening a ticket. */
export function ticketAckUserEmail({ userName, subject, dashboardUrl, locale = "ar" }) {
  const en = isEn(locale);
  const content = en
    ? `
    ${head("✅", "We received your request", `Hi ${userName} 👋`)}
    ${subjectLine("Subject:", subject)}
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      Thanks for reaching out. The support team will reply soon, and you'll get an email when there's a response.
      You can follow your ticket from the dashboard.
    </p>
    <div style="text-align:center;">${btn("View my tickets", dashboardUrl)}</div>`
    : `
    ${head("✅", "استلمنا طلبك", `مرحباً ${userName} 👋`)}
    ${subjectLine("الموضوع:", subject)}
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      شكراً لتواصلك معنا. سيردّ فريق الدعم في أقرب وقت، وستصلك رسالة عند وجود ردّ.
      يمكنك متابعة تذكرتك من لوحة التحكم.
    </p>
    <div style="text-align:center;">${btn("متابعة تذاكري", dashboardUrl)}</div>`;
  return {
    subject: en ? `We received your request — ${subject}` : `استلمنا طلبك — ${subject}`,
    html: shell(content, locale),
    text: en
      ? `Hi ${userName},\nWe received your request: ${subject}\nFollow up: ${dashboardUrl}`
      : `مرحباً ${userName}،\nاستلمنا طلبك: ${subject}\nمتابعة: ${dashboardUrl}`,
  };
}

/**
 * Acknowledgement to a guest, embedding the capability link to their thread.
 * Sent to an address the sender chose, so it deliberately contains NO
 * caller-supplied free text (no name/subject) — only a fixed notice + the link.
 * Defaults to Arabic (guests have no stored locale).
 */
export function ticketAckGuestEmail({ portalUrl }) {
  const content = `
    ${head("✅", "استلمنا رسالتك", "")}
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      شكراً لتواصلك مع Certify. احفظ الرابط التالي لمتابعة طلبك والاطّلاع على ردّ
      فريق الدعم والردّ عليه — لا حاجة لإنشاء حساب.
    </p>
    <div style="text-align:center;margin-bottom:20px;">${btn("متابعة طلبي", portalUrl)}</div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;word-break:break-all;">
      أو انسخ الرابط: ${e(portalUrl)}
    </p>`;
  return {
    subject: "استلمنا رسالتك — Certify",
    html: shell(content, "ar"),
    text: `استلمنا رسالتك في Certify.\nمتابعة طلبك: ${portalUrl}`,
  };
}

/** Notifies an authenticated user that the admin replied. */
export function adminReplyUserEmail({ userName, subject, dashboardUrl, locale = "ar" }) {
  const en = isEn(locale);
  const content = en
    ? `
    ${head("💬", "New reply on your ticket", `Hi ${userName} 👋`)}
    ${subjectLine("Subject:", subject)}
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      The support team replied to your ticket. Open the dashboard to read the reply and continue the conversation.
    </p>
    <div style="text-align:center;">${btn("View the reply", dashboardUrl)}</div>`
    : `
    ${head("💬", "ردّ جديد على تذكرتك", `مرحباً ${userName} 👋`)}
    ${subjectLine("الموضوع:", subject)}
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      ردّ فريق الدعم على تذكرتك. افتح لوحة التحكم للاطّلاع على الردّ ومتابعة المحادثة.
    </p>
    <div style="text-align:center;">${btn("عرض الردّ", dashboardUrl)}</div>`;
  return {
    subject: en ? `New reply on your ticket — ${subject}` : `ردّ جديد على تذكرتك — ${subject}`,
    html: shell(content, locale),
    text: en
      ? `Hi ${userName},\nThe support team replied to your ticket: ${subject}\n${dashboardUrl}`
      : `مرحباً ${userName}،\nردّ فريق الدعم على تذكرتك: ${subject}\n${dashboardUrl}`,
  };
}

/** Notifies a guest that the admin replied (Arabic — guests have no stored locale). */
export function adminReplyGuestEmail({ guestName, subject, portalUrl }) {
  const content = `
    ${head("💬", "ردّ جديد على طلبك", `مرحباً ${guestName} 👋`)}
    ${subjectLine("الموضوع:", subject)}
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      ردّ فريق الدعم على طلبك. افتح الرابط للاطّلاع على الردّ ومتابعة المحادثة.
    </p>
    <div style="text-align:center;margin-bottom:20px;">${btn("عرض الردّ", portalUrl)}</div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;word-break:break-all;">
      أو انسخ الرابط: ${e(portalUrl)}
    </p>`;
  return {
    subject: `ردّ جديد على طلبك — ${subject}`,
    html: shell(content, "ar"),
    text: `مرحباً ${guestName}،\nردّ فريق الدعم على طلبك: ${subject}\nعرض الردّ: ${portalUrl}`,
  };
}

/** Notifies the admin inbox that a customer (user or guest) replied (Arabic). */
export function customerReplyAdminEmail({ subject, requesterName, adminUrl }) {
  const content = `
    ${head("💬", "ردّ جديد من العميل", `من ${requesterName || "زائر"}`)}
    ${subjectLine("الموضوع:", subject)}
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      أضاف العميل ردّاً على تذكرته. افتح لوحة التذاكر لمتابعة المحادثة.
    </p>
    <div style="text-align:center;">${btn("فتح لوحة التذاكر", adminUrl)}</div>`;
  return {
    subject: `ردّ جديد من العميل — ${subject}`,
    html: shell(content, "ar"),
    text: `ردّ جديد من ${requesterName} على: ${subject}\n${adminUrl}`,
  };
}
