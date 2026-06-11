import { prisma } from "../db/prisma.js";
import { hashMatches } from "../services/certificateHasher.js";
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
  prisma.certificateEvent
    .create({
      data: {
        certificateId: cert.id,
        eventType: "opened",
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? null,
        referrer: req.get("referer") ?? null,
      },
    })
    .catch(() => {});
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
