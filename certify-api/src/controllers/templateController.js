import { z } from "zod";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";

const designSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  background: z.string().optional(),
  // Optional full-page background image (relative storage path or absolute URL).
  // Kept short — the image itself lives in /storage, never inline in design_data.
  backgroundImage: z.string().max(1024).optional(),
  elements: z.array(z.record(z.string(), z.any())).max(120, "عدد عناصر التصميم كبير جداً.").default([]),
  // Optional theme metadata (accent colors + logo box) used by the lightweight
  // customizer; kept so customized templates remain re-customizable.
  theme: z.record(z.string(), z.any()).optional(),
});

const upsertSchema = z.object({
  name: z.string().trim().min(1, "اسم القالب مطلوب.").max(160),
  description: z.string().trim().max(300).optional(),
  category: z.string().trim().max(60).optional(),
  orientation: z.enum(["landscape", "portrait"]).optional(),
  designData: designSchema,
});

function parseDesign(designData) {
  if (!designData) return null;
  try {
    return JSON.parse(designData);
  } catch {
    // Corrupted/non-JSON design data must not crash the endpoint with a 500.
    return null;
  }
}

function present(t) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    orientation: t.orientation,
    is_public: t.isPublic,
    design_data: parseDesign(t.designData),
    updated_at: t.updatedAt,
  };
}

/** GET /api/templates — current org's templates + public ones. */
export async function listTemplates(req, res) {
  const orgId = req.organization?.id ?? null;
  const templates = await prisma.template.findMany({
    where: { OR: [{ organizationId: orgId }, { isPublic: true }] },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ data: templates.map(present) });
}

/** GET /api/templates/:id */
export async function getTemplate(req, res) {
  const t = await prisma.template.findUnique({ where: { id: req.params.id } });
  if (!t || (t.organizationId && t.organizationId !== req.organization?.id && !t.isPublic)) {
    return res.status(404).json({ message: "القالب غير موجود." });
  }
  res.json(present(t));
}

/** POST /api/templates */
export async function createTemplate(req, res, next) {
  try {
    if (!req.organization) return res.status(400).json({ message: "لا توجد منظمة." });
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const d = parsed.data;
    const t = await prisma.template.create({
      data: {
        organizationId: req.organization.id,
        createdBy: req.user.id,
        name: d.name,
        description: d.description ?? null,
        category: d.category ?? "completion",
        orientation: d.orientation ?? "landscape",
        designData: JSON.stringify(d.designData),
      },
    });
    res.status(201).json(present(t));
  } catch (e) {
    next(e);
  }
}

/** PUT /api/templates/:id */
export async function updateTemplate(req, res, next) {
  try {
    const existing = await prisma.template.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.organizationId !== req.organization?.id) {
      return res.status(404).json({ message: "القالب غير موجود." });
    }
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const d = parsed.data;
    const t = await prisma.template.update({
      where: { id: req.params.id },
      data: {
        name: d.name,
        description: d.description ?? null,
        category: d.category ?? existing.category,
        orientation: d.orientation ?? existing.orientation,
        designData: JSON.stringify(d.designData),
      },
    });
    res.json(present(t));
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/templates/:id */
export async function deleteTemplate(req, res, next) {
  try {
    const existing = await prisma.template.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.organizationId !== req.organization?.id) {
      return res.status(404).json({ message: "القالب غير موجود." });
    }
    await prisma.template.delete({ where: { id: req.params.id } });
    // Clear any dangling default-template reference so issuance falls back to none.
    await prisma.organization.updateMany({
      where: { defaultTemplateId: req.params.id },
      data: { defaultTemplateId: null },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

const BG_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Resolve a stored asset path to an absolute URL (passthrough if already absolute). */
function assetUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${config.appUrl.replace(/\/$/, "")}/storage/${url}`;
}

/**
 * POST /api/templates/background — multipart/form-data with `file`.
 * Stores a full-page certificate background image and returns its path + URL.
 * The path is what gets saved into design_data.backgroundImage.
 */
export async function uploadTemplateBackground(req, res) {
  if (!req.organization) return res.status(400).json({ message: "لا توجد منظمة." });
  if (!req.file) return res.status(400).json({ message: "يرجى رفع صورة." });

  const ext = BG_EXT[req.file.mimetype] ?? "png";
  const relPath = path.join(
    "template-backgrounds",
    `${req.organization.id}-${crypto.randomBytes(6).toString("hex")}.${ext}`,
  );
  const absPath = path.join(config.storageDir, relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, req.file.buffer);

  res.status(201).json({ path: relPath, url: assetUrl(relPath) });
}

function validationError(res, parsed) {
  return res.status(422).json({
    message: parsed.error.issues[0]?.message ?? "بيانات غير صالحة.",
    errors: parsed.error.flatten().fieldErrors,
  });
}
