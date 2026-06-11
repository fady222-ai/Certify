import crypto from "node:crypto";
import { config } from "../config/index.js";

/**
 * Computes a tamper-evidence hash for a certificate: an HMAC-SHA256 over the
 * certificate's immutable fields keyed by the application secret. The
 * verification endpoint recomputes it and compares with the stored value to
 * detect any direct database tampering.
 */
function canonical(data) {
  return [
    data.id ?? "",
    data.organizationId ?? "",
    data.recipientName ?? "",
    data.recipientEmail ?? "",
    data.courseName ?? "",
    data.issueDate ?? "",
    data.verificationCode ?? "",
  ].join("|");
}

export function computeHash(data) {
  return crypto
    .createHmac("sha256", config.appKey)
    .update(canonical(data))
    .digest("hex");
}

/** Compute the hash for a Prisma certificate record. */
export function computeHashFor(cert) {
  return computeHash({
    id: cert.id,
    organizationId: cert.organizationId,
    recipientName: cert.recipientName,
    recipientEmail: cert.recipientEmail,
    courseName: cert.courseName,
    issueDate: toDateOnly(cert.issueDate),
    verificationCode: cert.verificationCode,
  });
}

/** Constant-time comparison of stored hash vs recomputed hash. */
export function hashMatches(cert) {
  const expected = Buffer.from(computeHashFor(cert));
  const actual = Buffer.from(cert.verificationHash ?? "");
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}

export function toDateOnly(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
