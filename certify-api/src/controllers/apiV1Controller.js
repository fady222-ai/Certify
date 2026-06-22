import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";
import { issueCertificate, PlanLimitError } from "../services/certificateIssuer.js";
import { verifyUrl } from "../services/certificateRenderer.js";

// Public developer API (v1). Authenticated by an API key (requireApiKey sets
// req.organization). Developer-facing → English messages + snake_case JSON.
const issueSchema = z.object({
  recipient_name: z.string().trim().min(2, "recipient_name is required (min 2 chars).").max(160),
  recipient_email: z.string().trim().email("recipient_email is invalid.").optional(),
  recipient_phone: z.string().trim().max(40).optional(),
  course_name: z.string().trim().max(200).optional(),
  issue_date: z.string().optional(),
  template_id: z.string().uuid("template_id must be a UUID.").optional(),
});

function present(c) {
  return {
    id: c.id,
    recipient_name: c.recipientName,
    recipient_email: c.recipientEmail,
    recipient_phone: c.recipientPhone,
    course_name: c.courseName,
    issue_date: c.issueDate ? new Date(c.issueDate).toISOString().slice(0, 10) : null,
    status: c.status,
    verification_code: c.verificationCode,
    verify_url: verifyUrl(c.verificationCode),
    pdf_url: c.pdfUrl ? `${config.appUrl.replace(/\/$/, "")}/storage/${c.pdfUrl}` : null,
    created_at: c.createdAt,
  };
}

/** POST /api/v1/certificates — issue a certificate programmatically. */
export async function apiIssueCertificate(req, res, next) {
  try {
    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        error: "validation_error",
        message: parsed.error.issues[0]?.message ?? "Invalid request body.",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const d = parsed.data;
    const cert = await issueCertificate(req.organization, {
      recipientName: d.recipient_name,
      recipientEmail: d.recipient_email || null,
      recipientPhone: d.recipient_phone || null,
      courseName: d.course_name || null,
      issueDate: d.issue_date || undefined,
      templateId: d.template_id || null,
    });
    return res.status(201).json(present(cert));
  } catch (e) {
    if (e instanceof PlanLimitError) {
      return res.status(402).json({ error: "plan_limit_reached", message: e.message });
    }
    if (e.statusCode === 404) {
      return res.status(404).json({ error: "template_not_found", message: e.message });
    }
    next(e);
  }
}

/** GET /api/v1/certificates — list this org's certificates (paginated). */
export async function apiListCertificates(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size, 10) || 50));
    const where = { organizationId: req.organization.id };
    const [data, total] = await Promise.all([
      prisma.certificate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.certificate.count({ where }),
    ]);
    res.json({ data: data.map(present), total, page, page_size: pageSize });
  } catch (e) {
    next(e);
  }
}

/** GET /api/v1/certificates/:id — fetch one certificate (org-scoped). */
export async function apiGetCertificate(req, res, next) {
  try {
    const cert = await prisma.certificate.findFirst({
      where: { id: req.params.id, organizationId: req.organization.id },
    });
    if (!cert) return res.status(404).json({ error: "not_found", message: "Certificate not found." });
    res.json(present(cert));
  } catch (e) {
    next(e);
  }
}
