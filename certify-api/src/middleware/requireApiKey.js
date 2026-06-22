import { prisma } from "../db/prisma.js";
import { hashApiKey } from "../services/apiKeyService.js";

/**
 * Authenticates a public API (/api/v1) request via `Authorization: Bearer <key>`.
 * Mirrors requireAuth but keyed on an API key instead of a JWT: looks the key up
 * by its SHA-256 hash, loads the owning organization (+plan), and gates on the
 * `hasApi` plan flag. Sets req.organization + req.apiKey (no membership role).
 * Developer-facing → English messages.
 */
export async function requireApiKey(req, res, next) {
  try {
    const header = req.get("authorization") ?? "";
    const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!raw) {
      return res.status(401).json({ error: "missing_api_key", message: "Provide your API key as a Bearer token." });
    }

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(raw) },
      include: { organization: { include: { plan: true } } },
    });
    if (!apiKey || apiKey.revokedAt) {
      return res.status(401).json({ error: "invalid_api_key", message: "Invalid or revoked API key." });
    }

    const organization = apiKey.organization;
    if (!organization || organization.suspendedAt) {
      return res.status(403).json({ error: "account_suspended", message: "This account is not active." });
    }
    if (!organization.plan?.hasApi) {
      return res.status(403).json({ error: "api_not_available", message: "API access is not available on your plan." });
    }

    req.organization = organization;
    req.apiKey = apiKey;

    // Best-effort "last used" tracking — never blocks the request.
    prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

    next();
  } catch {
    return res.status(401).json({ error: "invalid_api_key", message: "Invalid API key." });
  }
}
