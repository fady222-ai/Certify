import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";
import { issueCertificate, PlanLimitError } from "../services/certificateIssuer.js";

const issueSchema = z.object({
  recipientName: z.string().trim().min(2, "اسم المتدرب مطلوب.").max(160),
  recipientEmail: z.string().trim().email("بريد إلكتروني غير صالح.").optional().or(z.literal("")),
  courseName: z.string().trim().max(200).optional(),
  issueDate: z.string().optional(),
});

function pdfUrl(cert) {
  return cert.pdfUrl
    ? `${config.appUrl.replace(/\/$/, "")}/storage/${cert.pdfUrl}`
    : null;
}

function presentCertificate(c) {
  return {
    id: c.id,
    recipient_name: c.recipientName,
    recipient_email: c.recipientEmail,
    course_name: c.courseName,
    issue_date: c.issueDate ? new Date(c.issueDate).toISOString().slice(0, 10) : null,
    status: c.status,
    verification_code: c.verificationCode,
    opened_count: c.openedCount,
    pdf_url: pdfUrl(c),
    created_at: c.createdAt,
  };
}

/** GET /api/certificates — list certificates for the current organization. */
export async function listCertificates(req, res) {
  if (!req.organization) return res.json({ data: [], total: 0 });

  const [data, total] = await Promise.all([
    prisma.certificate.findMany({
      where: { organizationId: req.organization.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.certificate.count({ where: { organizationId: req.organization.id } }),
  ]);

  res.json({ data: data.map(presentCertificate), total });
}

/** POST /api/certificates — issue a single certificate (renders the PDF). */
export async function createCertificate(req, res, next) {
  try {
    if (!req.organization) {
      return res.status(400).json({ message: "لا توجد منظمة مرتبطة بالحساب." });
    }

    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        message: parsed.error.issues[0]?.message ?? "بيانات غير صالحة.",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const data = parsed.data;
    const cert = await issueCertificate(req.organization, {
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail || null,
      courseName: data.courseName || null,
      issueDate: data.issueDate || undefined,
    });

    return res.status(201).json(presentCertificate(cert));
  } catch (e) {
    if (e instanceof PlanLimitError) {
      return res.status(e.statusCode).json({ message: e.message });
    }
    next(e);
  }
}

/** GET /api/me/stats — dashboard summary for the current organization. */
export async function dashboardStats(req, res) {
  if (!req.organization) {
    return res.json({ issued_total: 0, issued_this_month: 0, opened_total: 0, plan: null, limit: null });
  }
  const org = req.organization;
  const month = new Date().toISOString().slice(0, 7);

  const [issuedTotal, usage, openedAgg] = await Promise.all([
    prisma.certificate.count({ where: { organizationId: org.id } }),
    prisma.certificateUsage.findUnique({
      where: { organizationId_month: { organizationId: org.id, month } },
    }),
    prisma.certificate.aggregate({
      where: { organizationId: org.id },
      _sum: { openedCount: true },
    }),
  ]);

  res.json({
    issued_total: issuedTotal,
    issued_this_month: usage?.certificatesIssued ?? 0,
    opened_total: openedAgg._sum.openedCount ?? 0,
    plan: org.plan ? { slug: org.plan.slug, name: org.plan.name } : null,
    limit: org.plan?.certificatesPerMonth ?? null,
  });
}
