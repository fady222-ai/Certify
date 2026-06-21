import { prisma } from "../db/prisma.js";
import { hashMatches } from "../services/certificateHasher.js";
import { logCertificateEvent } from "../services/certificateEvents.js";
import { config } from "../config/index.js";

function issueDateLabel(date) {
  if (!date) return null;
  return new Intl.DateTimeFormat("ar", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date instanceof Date ? date : new Date(date));
}

function isValid(cert) {
  return (
    cert.status === "active" &&
    (!cert.expiryDate || new Date(cert.expiryDate) > new Date())
  );
}

/**
 * Public certificate verification endpoint.
 * GET /api/verify/:code
 */
export async function showVerification(req, res) {
  const { code } = req.params;

  const cert = await prisma.certificate.findUnique({
    where: { verificationCode: code },
    include: { organization: true },
  });

  if (!cert) {
    return res.status(404).json({
      found: false,
      message: "لم يتم العثور على شهادة بهذا الرمز.",
    });
  }

  // Log the verification view (network-effect surface) — fire and forget.
  logCertificateEvent(cert.id, "opened", {
    ipAddress: req.ip,
    userAgent: req.get("user-agent") ?? null,
    referrer: req.get("referer") ?? null,
  }).catch(() => {});
  prisma.certificate
    .update({
      where: { id: cert.id },
      data: { openedCount: { increment: 1 } },
    })
    .catch(() => {});

  const integrity = hashMatches(cert);
  const org = cert.organization;
  const issueDateStr = cert.issueDate
    ? new Date(cert.issueDate).toISOString().slice(0, 10)
    : null;

  return res.json({
    found: true,
    valid: isValid(cert),
    integrity,
    status: cert.status,
    certificate: {
      recipient_name: cert.recipientName,
      course_name: cert.courseName,
      issue_date: issueDateStr,
      issue_date_label: issueDateLabel(cert.issueDate),
      expiry_date: cert.expiryDate
        ? new Date(cert.expiryDate).toISOString().slice(0, 10)
        : null,
      verification_code: cert.verificationCode,
      pdf_url: cert.pdfUrl
        ? `${config.appUrl.replace(/\/$/, "")}/storage/${cert.pdfUrl}`
        : null,
      organization: {
        name: org?.name ?? null,
        logo_url: org?.logoUrl ?? null,
        primary_color: org?.primaryColor ?? "#4f46e5",
      },
    },
  });
}

// Public event types that may be tracked from the verification page → DB column.
const TRACKABLE = {
  downloaded: "downloadedCount",
  shared: "sharedCount",
  added_to_linkedin: null, // logged as event only; also flips linkedinAdded
};

/**
 * Track a public interaction with a certificate (download / share / LinkedIn).
 * POST /api/verify/:code/track  { type }
 * Fire-and-forget from the client; always returns 204 quickly.
 */
export async function trackEvent(req, res) {
  const { code } = req.params;
  const type = (req.body?.type ?? "").toString();

  if (!Object.prototype.hasOwnProperty.call(TRACKABLE, type)) {
    return res.status(400).json({ message: "نوع حدث غير معروف." });
  }

  const cert = await prisma.certificate.findUnique({
    where: { verificationCode: code },
    select: { id: true },
  });
  if (!cert) return res.status(404).json({ message: "غير موجود." });

  // Log event + bump the matching counter (and linkedinAdded flag).
  logCertificateEvent(cert.id, type, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent") ?? null,
    referrer: req.get("referer") ?? null,
  }).catch(() => {});

  const counterField = TRACKABLE[type];
  const update = {};
  if (counterField) update[counterField] = { increment: 1 };
  if (type === "added_to_linkedin") update.linkedinAdded = true;
  if (Object.keys(update).length > 0) {
    prisma.certificate.update({ where: { id: cert.id }, data: update }).catch(() => {});
  }

  return res.status(204).end();
}
