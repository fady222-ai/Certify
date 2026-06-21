import path from "node:path";
import fs from "node:fs/promises";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";
import { issueCertificate, PlanLimitError } from "../services/certificateIssuer.js";
import { sendCertificateEmail } from "../services/certificateMailer.js";
import { renderPdf } from "../services/certificateRenderer.js";

const issueSchema = z.object({
  recipientName: z.string().trim().min(2, "اسم المتدرب مطلوب.").max(160),
  recipientEmail: z.string().trim().email("بريد إلكتروني غير صالح.").optional().or(z.literal("")),
  courseName: z.string().trim().max(200).optional(),
  issueDate: z.string().optional(),
  templateId: z.string().uuid().optional(),
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

  const search = (req.query.search ?? "").toString().trim();
  const status = (req.query.status ?? "").toString().trim();

  // Pagination: page is 1-based; pageSize is capped so a single request can
  // never pull an unbounded result set (keeps the list fast for big orgs).
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 50));

  const where = { organizationId: req.organization.id };
  if (status && ["active", "revoked", "expired"].includes(status)) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { recipientName: { contains: search, mode: "insensitive" } },
      { recipientEmail: { contains: search, mode: "insensitive" } },
      { courseName: { contains: search, mode: "insensitive" } },
      { verificationCode: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.certificate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.certificate.count({ where }),
  ]);

  res.json({ data: data.map(presentCertificate), total, page, pageSize });
}

/** GET /api/certificates/:id — single certificate detail with recent events. */
export async function getCertificate(req, res) {
  if (!req.organization) return res.status(404).json({ message: "غير موجود." });

  const cert = await prisma.certificate.findFirst({
    where: { id: req.params.id, organizationId: req.organization.id },
    include: {
      events: { orderBy: { createdAt: "desc" }, take: 25 },
      template: { select: { id: true, name: true } },
    },
  });
  if (!cert) return res.status(404).json({ message: "الشهادة غير موجودة." });

  return res.json({
    ...presentCertificate(cert),
    expiry_date: cert.expiryDate ? new Date(cert.expiryDate).toISOString().slice(0, 10) : null,
    downloaded_count: cert.downloadedCount,
    shared_count: cert.sharedCount,
    linkedin_added: cert.linkedinAdded,
    revoked_at: cert.revokedAt,
    revoked_reason: cert.revokedReason,
    template: cert.template ?? null,
    events: cert.events.map((e) => ({
      type: e.eventType,
      at: e.createdAt,
    })),
  });
}

/** POST /api/certificates/:id/revoke — revoke a certificate with a reason. */
export async function revokeCertificate(req, res) {
  if (!req.organization) return res.status(404).json({ message: "غير موجود." });

  const cert = await prisma.certificate.findFirst({
    where: { id: req.params.id, organizationId: req.organization.id },
  });
  if (!cert) return res.status(404).json({ message: "الشهادة غير موجودة." });
  if (cert.status === "revoked") {
    return res.status(409).json({ message: "الشهادة ملغاة بالفعل." });
  }

  const reason = (req.body?.reason ?? "").toString().trim() || null;

  const updated = await prisma.certificate.update({
    where: { id: cert.id },
    data: {
      status: "revoked",
      revokedAt: new Date(),
      revokedReason: reason,
      pdfUrl: null,
      events: { create: { eventType: "revoked", metadata: reason ? JSON.stringify({ reason }) : null } },
    },
  });

  // Delete the rendered PDF from disk so the public /storage link stops working
  // immediately — a revoked certificate must not remain downloadable.
  if (cert.pdfUrl && !/^https?:\/\//i.test(cert.pdfUrl)) {
    fs.unlink(path.join(config.storageDir, cert.pdfUrl)).catch(() => {});
  }

  return res.json(presentCertificate(updated));
}

/** POST /api/certificates/:id/reactivate — restore a revoked certificate. */
export async function reactivateCertificate(req, res) {
  if (!req.organization) return res.status(404).json({ message: "غير موجود." });

  const cert = await prisma.certificate.findFirst({
    where: { id: req.params.id, organizationId: req.organization.id },
  });
  if (!cert) return res.status(404).json({ message: "الشهادة غير موجودة." });
  if (cert.status !== "revoked") {
    return res.status(409).json({ message: "الشهادة غير ملغاة." });
  }

  const updated = await prisma.certificate.update({
    where: { id: cert.id },
    data: {
      status: "active",
      revokedAt: null,
      revokedReason: null,
      events: { create: { eventType: "reactivated" } },
    },
  });

  // Re-render the PDF that revocation deleted so the public /storage link works
  // again. renderPdf persists pdfUrl itself; wrap in try/catch so a transient
  // browser failure doesn't fail the whole request (status is already active).
  try {
    const relPath = await renderPdf(updated);
    updated.pdfUrl = relPath;
  } catch {
    // PDF can be regenerated later (e.g. via resend); status restore stands.
  }

  return res.json(presentCertificate(updated));
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
      templateId: data.templateId || null,
    });

    return res.status(201).json(presentCertificate(cert));
  } catch (e) {
    if (e instanceof PlanLimitError) {
      return res.status(e.statusCode).json({ message: e.message });
    }
    next(e);
  }
}

/** POST /api/certificates/:id/resend-email — re-send the certificate email. */
export async function resendCertificateEmail(req, res) {
  if (!req.organization) return res.status(404).json({ message: "غير موجود." });

  const cert = await prisma.certificate.findFirst({
    where: { id: req.params.id, organizationId: req.organization.id },
    include: { organization: true },
  });
  if (!cert) return res.status(404).json({ message: "الشهادة غير موجودة." });
  if (!cert.recipientEmail) {
    return res.status(422).json({ message: "لا يوجد بريد إلكتروني لهذه الشهادة." });
  }

  const result = await sendCertificateEmail(cert);
  if (!result.ok) {
    return res.status(502).json({ message: "تعذّر إرسال البريد.", transport: result.transport });
  }
  return res.json({ message: "تم إرسال البريد.", transport: result.transport });
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
