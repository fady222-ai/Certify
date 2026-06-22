import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { generateApiKey, presentApiKey } from "../services/apiKeyService.js";

const createSchema = z.object({
  name: z.string().trim().min(1, "اسم المفتاح مطلوب.").max(80),
});

/** GET /api/api-keys — list the org's keys (masked; never the raw secret). */
export async function listApiKeys(req, res) {
  if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
  const keys = await prisma.apiKey.findMany({
    where: { organizationId: req.organization.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    data: keys.map(presentApiKey),
    has_api: !!req.organization.plan?.hasApi,
  });
}

/** POST /api/api-keys — create a key; returns the raw secret exactly once. */
export async function createApiKey(req, res, next) {
  try {
    if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
    if (!req.organization.plan?.hasApi) {
      return res.status(403).json({ message: "الوصول البرمجي (API) متاح في الباقات المدفوعة. يرجى ترقية باقتك." });
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ message: parsed.error.issues[0]?.message ?? "بيانات غير صالحة." });
    }

    const gen = generateApiKey();
    const key = await prisma.apiKey.create({
      data: {
        organizationId: req.organization.id,
        name: parsed.data.name,
        keyHash: gen.keyHash,
        keyEnc: gen.keyEnc,
        prefix: gen.prefix,
        last4: gen.last4,
        createdById: req.user?.id ?? null,
      },
    });

    // The raw key is shown ONLY here and never stored in clear / returned again.
    res.status(201).json({ ...presentApiKey(key), key: gen.raw });
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/api-keys/:id — revoke a key (org-scoped). */
export async function revokeApiKey(req, res, next) {
  try {
    if (!req.organization) return res.status(404).json({ message: "لا توجد منظمة." });
    const key = await prisma.apiKey.findFirst({
      where: { id: req.params.id, organizationId: req.organization.id, revokedAt: null },
    });
    if (!key) return res.status(404).json({ message: "المفتاح غير موجود." });

    await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
