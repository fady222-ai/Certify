// Email templates for the support ticket system. Mirrors authTemplates.js:
// the same private e()/shell()/btn() helpers (kept local to each template file
// per the established pattern) wrap RTL Arabic content for both flows
// (authenticated users and public guests).

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

function head(emoji, title, sub) {
  return `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">${emoji}</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${e(title)}</h1>
      ${sub ? `<p style="margin:0;font-size:14px;color:#6b7280;">${e(sub)}</p>` : ""}
    </div>`;
}

function subjectLine(subject) {
  return `<p style="font-size:13px;color:#6b7280;background:#f8fafc;border:1px solid #eef2f7;border-radius:10px;padding:12px 16px;margin:0 0 24px;">
    <strong style="color:#374151;">الموضوع:</strong> ${e(subject)}</p>`;
}

/** Sent to the admin inbox when ANY new ticket is opened. */
export function newTicketAdminEmail({ subject, requesterName, requesterEmail, adminUrl }) {
  const content = `
    ${head("📨", "تذكرة دعم جديدة", `من ${requesterName || requesterEmail || "زائر"}`)}
    ${subjectLine(subject)}
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      وصلت تذكرة دعم جديدة وتنتظر ردّك. افتح لوحة التذاكر للاطّلاع والردّ.
    </p>
    <div style="text-align:center;">${btn("فتح لوحة التذاكر", adminUrl)}</div>`;
  return {
    subject: `تذكرة دعم جديدة — ${subject}`,
    html: shell(content),
    text: `تذكرة دعم جديدة من ${requesterName || requesterEmail}\nالموضوع: ${subject}\n${adminUrl}`,
  };
}

/** Acknowledgement to an authenticated user after opening a ticket. */
export function ticketAckUserEmail({ userName, subject, dashboardUrl }) {
  const content = `
    ${head("✅", "استلمنا طلبك", `مرحباً ${userName} 👋`)}
    ${subjectLine(subject)}
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      شكراً لتواصلك معنا. سيردّ فريق الدعم في أقرب وقت، وستصلك رسالة عند وجود ردّ.
      يمكنك متابعة تذكرتك من لوحة التحكم.
    </p>
    <div style="text-align:center;">${btn("متابعة تذاكري", dashboardUrl)}</div>`;
  return {
    subject: `استلمنا طلبك — ${subject}`,
    html: shell(content),
    text: `مرحباً ${userName}،\nاستلمنا طلبك: ${subject}\nمتابعة: ${dashboardUrl}`,
  };
}

/**
 * Acknowledgement to a guest, embedding the capability link to their thread.
 * Sent to an address the sender chose, so it deliberately contains NO
 * caller-supplied free text (no name/subject) — only a fixed notice + the link.
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
    html: shell(content),
    text: `استلمنا رسالتك في Certify.\nمتابعة طلبك: ${portalUrl}`,
  };
}

/** Notifies an authenticated user that the admin replied. */
export function adminReplyUserEmail({ userName, subject, dashboardUrl }) {
  const content = `
    ${head("💬", "ردّ جديد على تذكرتك", `مرحباً ${userName} 👋`)}
    ${subjectLine(subject)}
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      ردّ فريق الدعم على تذكرتك. افتح لوحة التحكم للاطّلاع على الردّ ومتابعة المحادثة.
    </p>
    <div style="text-align:center;">${btn("عرض الردّ", dashboardUrl)}</div>`;
  return {
    subject: `ردّ جديد على تذكرتك — ${subject}`,
    html: shell(content),
    text: `مرحباً ${userName}،\nردّ فريق الدعم على تذكرتك: ${subject}\n${dashboardUrl}`,
  };
}

/** Notifies a guest that the admin replied, embedding the capability link. */
export function adminReplyGuestEmail({ guestName, subject, portalUrl }) {
  const content = `
    ${head("💬", "ردّ جديد على طلبك", `مرحباً ${guestName} 👋`)}
    ${subjectLine(subject)}
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      ردّ فريق الدعم على طلبك. افتح الرابط للاطّلاع على الردّ ومتابعة المحادثة.
    </p>
    <div style="text-align:center;margin-bottom:20px;">${btn("عرض الردّ", portalUrl)}</div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;word-break:break-all;">
      أو انسخ الرابط: ${e(portalUrl)}
    </p>`;
  return {
    subject: `ردّ جديد على طلبك — ${subject}`,
    html: shell(content),
    text: `مرحباً ${guestName}،\nردّ فريق الدعم على طلبك: ${subject}\nعرض الردّ: ${portalUrl}`,
  };
}

/** Notifies the admin inbox that a customer (user or guest) replied. */
export function customerReplyAdminEmail({ subject, requesterName, adminUrl }) {
  const content = `
    ${head("💬", "ردّ جديد من العميل", `من ${requesterName || "زائر"}`)}
    ${subjectLine(subject)}
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
      أضاف العميل ردّاً على تذكرته. افتح لوحة التذاكر لمتابعة المحادثة.
    </p>
    <div style="text-align:center;">${btn("فتح لوحة التذاكر", adminUrl)}</div>`;
  return {
    subject: `ردّ جديد من العميل — ${subject}`,
    html: shell(content),
    text: `ردّ جديد من ${requesterName} على: ${subject}\n${adminUrl}`,
  };
}
