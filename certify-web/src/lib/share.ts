// Pure builders for social-share deep links. Kept dependency-free and unit-tested
// (see share.test.ts) so the URL/encoding logic can't silently break.

/** Normalize a phone number to wa.me form: digits only, no leading + or spaces. */
function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 6 ? digits : null;
}

/**
 * WhatsApp share/send link. With a phone it targets that contact directly
 * (https://wa.me/<phone>?text=...); without one it opens the generic share sheet.
 */
export function whatsappShareUrl({
  text,
  url,
  phone,
}: {
  text: string;
  url: string;
  phone?: string | null;
}): string {
  const body = encodeURIComponent(`${text}\n${url}`);
  const target = normalizePhone(phone);
  return target
    ? `https://wa.me/${target}?text=${body}`
    : `https://wa.me/?text=${body}`;
}

/** X / Twitter "intent" share link. */
export function twitterShareUrl({ text, url }: { text: string; url: string }): string {
  const params = new URLSearchParams({ text, url });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/** Default Arabic congratulatory share text mentioning course + issuer. */
export function shareText({
  recipientName,
  courseName,
  orgName,
}: {
  recipientName?: string | null;
  courseName?: string | null;
  orgName?: string | null;
}): string {
  const course = courseName?.trim();
  const org = orgName?.trim();
  const who = recipientName?.trim();
  if (who && course) {
    return `🎓 حصل ${who} على شهادة «${course}»${org ? ` من ${org}` : ""}. تحقّق من صحتها:`;
  }
  if (course) return `🎓 شهادة «${course}»${org ? ` من ${org}` : ""} — تحقّق من صحتها:`;
  return "🎓 شهادة موثّقة — تحقّق من صحتها:";
}
