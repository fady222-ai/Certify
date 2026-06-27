import { e, shell, btn, isEn } from "./emailI18n.js";

/**
 * Magic-link email giving a trainee access to their certificate wallet — every
 * certificate issued to their email, across academies. The link is a signed,
 * expiring capability delivered only to the address that owns it.
 */
export function walletLinkEmail({ url, count, locale = "ar" }) {
  const en = isEn(locale);
  const subject = en ? "Your certificate wallet — Certify" : "محفظة شهاداتك — Certify";

  const content = en
    ? `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">🎓</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">Your certificate wallet</h1>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 22px;">
      We found <strong>${count}</strong> certificate(s) issued to your email. Open your wallet to
      view, download, verify, and share them — no account needed.
    </p>
    <div style="text-align:center;margin-bottom:22px;">${btn("Open my wallet", url)}</div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
      This link is private to you and expires in 7 days. If you didn't request it, ignore this email.
    </p>`
    : `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:44px;margin-bottom:10px;">🎓</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">محفظة شهاداتك</h1>
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 22px;">
      وجدنا <strong>${count}</strong> شهادة صادرة لبريدك. افتح محفظتك لعرضها وتحميلها والتحقق منها
      ومشاركتها — دون الحاجة لحساب.
    </p>
    <div style="text-align:center;margin-bottom:22px;">${btn("افتح محفظتي", url)}</div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
      هذا الرابط خاص بك وينتهي خلال 7 أيام. إن لم تطلبه، تجاهل هذه الرسالة.
    </p>`;

  return {
    subject,
    html: shell(content, locale),
    text: en
      ? `Your certificate wallet (${count} certificate(s)): ${url}\nThis private link expires in 7 days.`
      : `محفظة شهاداتك (${count} شهادة): ${url}\nهذا الرابط الخاص ينتهي خلال 7 أيام.`,
  };
}
