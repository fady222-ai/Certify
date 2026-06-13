import crypto from "node:crypto";
import { prisma } from "../db/prisma.js";
import { computeHash, toDateOnly } from "./certificateHasher.js";
import { renderPdf } from "./certificateRenderer.js";
import { sendCertificateEmail } from "./certificateMailer.js";

/** Error thrown when an organization exceeds its monthly plan limit. */
export class PlanLimitError extends Error {
  constructor(limit) {
    super(`تم بلوغ الحد الشهري للباقة (${limit} شهادة). يرجى ترقية الباقة.`);
    this.name = "PlanLimitError";
    this.statusCode = 402;
  }
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

// Unambiguous uppercase alphabet (no 0/1/I/O) for safe manual transcription.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_GROUPS = 4; // CERT-XXXX-XXXX-XXXX-XXXX → 16 chars ≈ 78 bits of entropy

/** Cryptographically-random token of `len` chars from the unambiguous alphabet. */
function randomToken(len) {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Build a high-entropy verification code, e.g. CERT-AB12-CD34-EF56-GH78.
 * ~78 bits of entropy makes an accidental collision astronomically unlikely;
 * the verification_code column is also @unique, so a duplicate can never be
 * stored even in theory. The DB check + retry below is cheap belt-and-braces.
 */
async function generateCode() {
  for (let i = 0; i < 12; i++) {
    const groups = Array.from({ length: CODE_GROUPS }, () => randomToken(4));
    const code = `CERT-${groups.join("-")}`;
    const exists = await prisma.certificate.findUnique({
      where: { verificationCode: code },
    });
    if (!exists) return code;
  }
  throw new Error("Failed to generate a unique verification code.");
}

/**
 * Verify a requested templateId is usable by this organization: it must exist
 * and be either public or owned by the org. Prevents cross-tenant template use
 * (IDOR) where org B issues a certificate rendered with org A's private design.
 */
async function assertTemplateAccessible(organization, templateId) {
  if (!templateId) return;
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  const accessible =
    template &&
    (template.isPublic || !template.organizationId || template.organizationId === organization.id);
  if (!accessible) {
    const err = new Error("القالب غير موجود أو لا يمكن الوصول إليه.");
    err.statusCode = 404;
    throw err;
  }
}

async function assertWithinPlanLimit(organization) {
  if (!organization.planId) return; // no plan attached yet
  const plan = await prisma.plan.findUnique({ where: { id: organization.planId } });
  if (!plan || plan.certificatesPerMonth == null) return;

  const usage = await prisma.certificateUsage.findUnique({
    where: {
      organizationId_month: {
        organizationId: organization.id,
        month: currentMonth(),
      },
    },
  });
  const used = usage?.certificatesIssued ?? 0;
  if (used >= plan.certificatesPerMonth) {
    throw new PlanLimitError(plan.certificatesPerMonth);
  }
}

async function incrementUsage(organizationId) {
  const month = currentMonth();
  await prisma.certificateUsage.upsert({
    where: { organizationId_month: { organizationId, month } },
    create: { organizationId, month, certificatesIssued: 1 },
    update: { certificatesIssued: { increment: 1 } },
  });
}

/**
 * Issue a single certificate: generates a unique code + tamper hash, enforces
 * the plan limit, tracks usage, logs an "issued" event, and (optionally)
 * renders the PDF synchronously. Bulk flows pass render=false and render in a
 * background worker.
 *
 * @param {object} organization Prisma organization record
 * @param {object} data         { recipientName, recipientEmail?, courseName?, issueDate?, ... }
 * @param {boolean} render
 * @param {object} [options]     { sendMail?: boolean } — email the recipient (default true)
 */
export async function issueCertificate(organization, data, render = true, options = {}) {
  const { sendMail = true } = options;
  await assertTemplateAccessible(organization, data.templateId);
  await assertWithinPlanLimit(organization);

  const id = crypto.randomUUID();
  const verificationCode = await generateCode();
  const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();

  const verificationHash = computeHash({
    id,
    organizationId: organization.id,
    recipientName: data.recipientName,
    recipientEmail: data.recipientEmail ?? null,
    courseName: data.courseName ?? null,
    issueDate: toDateOnly(issueDate),
    verificationCode,
  });

  const cert = await prisma.certificate.create({
    data: {
      id,
      organizationId: organization.id,
      templateId: data.templateId ?? null,
      batchId: data.batchId ?? null,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail ?? null,
      recipientPhone: data.recipientPhone ?? null,
      courseName: data.courseName ?? null,
      issueDate,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      customFields: data.customFields ? JSON.stringify(data.customFields) : null,
      status: "active",
      verificationCode,
      verificationHash,
      events: { create: { eventType: "issued" } },
    },
    include: { organization: true },
  });

  await incrementUsage(organization.id);

  if (render) {
    const relPath = await renderPdf(cert);
    cert.pdfUrl = relPath; // reflect the rendered PDF on the returned record
  }

  // Email the recipient (best-effort, non-blocking) once the PDF link exists.
  if (sendMail && cert.recipientEmail) {
    sendCertificateEmail(cert).catch((e) =>
      console.error(`[mailer] failed for ${cert.verificationCode}:`, e.message)
    );
  }

  return cert;
}
