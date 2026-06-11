import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";
import { verifyUrl } from "./certificateRenderer.js";
import { sendEmail } from "./email/index.js";
import { certificateEmail } from "./email/templates.js";

function pdfAbsoluteUrl(pdfUrl) {
  if (!pdfUrl) return null;
  if (/^https?:\/\//i.test(pdfUrl)) return pdfUrl;
  return `${config.appUrl.replace(/\/$/, "")}/storage/${pdfUrl}`;
}

/**
 * Send the certificate email to its recipient (best-effort). Logs an "emailed"
 * event on success. Returns the transport result. Never throws.
 *
 * @param {object} cert  certificate record (ideally with `organization` included)
 */
export async function sendCertificateEmail(cert) {
  if (!cert?.recipientEmail) return { ok: false, transport: "none", error: "no recipient email" };

  const org =
    cert.organization ??
    (cert.organizationId
      ? await prisma.organization.findUnique({ where: { id: cert.organizationId } })
      : null);

  const { subject, html, text } = certificateEmail({
    recipientName: cert.recipientName,
    courseName: cert.courseName ?? null,
    orgName: org?.name ?? "منصة الشهادات",
    verifyUrl: verifyUrl(cert.verificationCode),
    pdfUrl: pdfAbsoluteUrl(cert.pdfUrl),
    primaryColor: org?.primaryColor ?? "#4f46e5",
  });

  const result = await sendEmail({ to: cert.recipientEmail, subject, html, text });

  if (result.ok) {
    prisma.certificateEvent
      .create({
        data: {
          certificateId: cert.id,
          eventType: "emailed",
          metadata: JSON.stringify({ transport: result.transport, id: result.id ?? null }),
        },
      })
      .catch(() => {});
  }

  return result;
}
