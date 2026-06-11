import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";

/** Resolve a stored asset path to an absolute URL (passthrough if already absolute). */
function assetUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${config.appUrl.replace(/\/$/, "")}/storage/${url}`;
}

function presentOrganization(org) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    primary_color: org.primaryColor,
    secondary_color: org.secondaryColor,
    logo_url: assetUrl(org.logoUrl),
    signature_url: assetUrl(org.signatureUrl),
    verify_domain: org.verifyDomain,
  };
}

const HEX = /^#([0-9a-fA-F]{6})$/;
const updateSchema = z.object({
  name: z.string().trim().min(2, "اسم المنظمة قصير جداً.").max(120).optional(),
  primaryColor: z.string().regex(HEX, "لون غير صالح.").optional(),
  secondaryColor: z.string().regex(HEX, "لون غير صالح.").optional().or(z.literal("")),
});

/** GET /api/organization — current organization profile. */
export async function getOrganization(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
  res.json(presentOrganization(req.organization));
}

/** PATCH /api/organization — update name / colors. */
export async function updateOrganization(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
  if (req.organization.ownerId !== req.user.id) {
    return res.status(403).json({ message: "فقط مالك المنظمة يمكنه التعديل." });
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ message: parsed.error.issues[0]?.message ?? "بيانات غير صالحة." });
  }

  const data = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.primaryColor !== undefined) data.primaryColor = parsed.data.primaryColor;
  if (parsed.data.secondaryColor !== undefined) {
    data.secondaryColor = parsed.data.secondaryColor || null;
  }

  const org = await prisma.organization.update({
    where: { id: req.organization.id },
    data,
  });
  res.json(presentOrganization(org));
}

const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * POST /api/organization/branding/:kind  (kind = logo | signature)
 * multipart/form-data with `file` — stores the image and updates the org.
 */
export async function uploadBranding(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
  if (req.organization.ownerId !== req.user.id) {
    return res.status(403).json({ message: "فقط مالك المنظمة يمكنه التعديل." });
  }
  const { kind } = req.params;
  if (kind !== "logo" && kind !== "signature") {
    return res.status(400).json({ message: "نوع غير معروف." });
  }
  if (!req.file) return res.status(400).json({ message: "يرجى رفع صورة." });

  const ext = EXT[req.file.mimetype] ?? "png";
  const relPath = path.join("branding", `${req.organization.id}-${kind}-${crypto.randomBytes(4).toString("hex")}.${ext}`);
  const absPath = path.join(config.storageDir, relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, req.file.buffer);

  const field = kind === "logo" ? "logoUrl" : "signatureUrl";

  // Remove the previous asset (best-effort) to avoid orphaned files.
  const prev = req.organization[field];
  if (prev && !/^https?:\/\//i.test(prev)) {
    fs.unlink(path.join(config.storageDir, prev)).catch(() => {});
  }

  const org = await prisma.organization.update({
    where: { id: req.organization.id },
    data: { [field]: relPath },
  });
  res.json(presentOrganization(org));
}

/** DELETE /api/organization/branding/:kind — remove logo or signature. */
export async function deleteBranding(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
  if (req.organization.ownerId !== req.user.id) {
    return res.status(403).json({ message: "فقط مالك المنظمة يمكنه التعديل." });
  }
  const { kind } = req.params;
  if (kind !== "logo" && kind !== "signature") {
    return res.status(400).json({ message: "نوع غير معروف." });
  }
  const field = kind === "logo" ? "logoUrl" : "signatureUrl";
  const prev = req.organization[field];
  if (prev && !/^https?:\/\//i.test(prev)) {
    fs.unlink(path.join(config.storageDir, prev)).catch(() => {});
  }
  const org = await prisma.organization.update({
    where: { id: req.organization.id },
    data: { [field]: null },
  });
  res.json(presentOrganization(org));
}
