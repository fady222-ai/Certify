import { prisma } from "../db/prisma.js";
import { encryptSecret, decryptSecret } from "./secretCrypto.js";
import { isWhatsappEnabledPlatform } from "./platformSettings.js";

// ─────────────────────────────────────────────────────────────────────────────
// Per-organization WhatsApp Cloud API credentials (Meta Graph API). Mirrors the
// payment-gateway config pattern: one AES-GCM encrypted JSON blob per org, an
// in-memory cache keyed by orgId (refreshed on write), and an admin/owner API
// that only ever returns masked secret previews.
//
// A certificate can be WhatsApp-delivered only when ALL of:
//   1. the platform admin enabled the feature (platformSettings), AND
//   2. the org owner enabled it for their org (enabled), AND
//   3. the required credentials are present, AND
//   4. the recipient has a phone number.
// ─────────────────────────────────────────────────────────────────────────────

// Field metadata. `secret: true` is never returned in full (masked only).
export const WHATSAPP_FIELDS = [
  { key: "phoneNumberId", label: "Phone Number ID", secret: false, required: true },
  { key: "accessToken", label: "Access Token", secret: true, required: true },
  { key: "templateName", label: "Template Name", secret: false, required: true },
  { key: "languageCode", label: "Template Language", secret: false, required: false },
];

const REQUIRED = WHATSAPP_FIELDS.filter((f) => f.required).map((f) => f.key);
const MAX_FIELD_LEN = 2048; // access tokens can be long; cap to bound the blob

const cache = new Map(); // orgId -> { enabled, fields }

function decodeRow(row) {
  let fields = {};
  try {
    fields = JSON.parse(decryptSecret(row.secrets));
  } catch (e) {
    console.error(`[whatsappConfig] decrypt failed for org ${row.organizationId}:`, e.message);
  }
  return { enabled: row.enabled, fields };
}

/** Load all org WhatsApp configs into the cache. Call at boot. */
export async function loadWhatsappConfigs() {
  try {
    const rows = await prisma.whatsappConfig.findMany();
    cache.clear();
    for (const row of rows) cache.set(row.organizationId, decodeRow(row));
    if (rows.length) console.log(`[whatsappConfig] loaded ${rows.length} config(s) from DB`);
  } catch (e) {
    console.error("[whatsappConfig] load skipped:", e.message);
  }
}

/** Refresh a single org's cached config after a write. */
export async function refreshWhatsappConfig(orgId) {
  const row = await prisma.whatsappConfig.findUnique({ where: { organizationId: orgId } });
  if (!row) cache.delete(orgId);
  else cache.set(orgId, decodeRow(row));
}

function entryOf(orgId) {
  return cache.get(orgId) ?? { enabled: false, fields: {} };
}

/** Resolved credentials for an org (used by the sender). */
export function whatsappCredentials(orgId) {
  const { fields } = entryOf(orgId);
  return {
    phoneNumberId: fields.phoneNumberId || "",
    accessToken: fields.accessToken || "",
    templateName: fields.templateName || "",
    languageCode: fields.languageCode || "en_US",
  };
}

function hasRequired(fields) {
  return REQUIRED.every((k) => fields?.[k] != null && String(fields[k]).trim() !== "");
}

/** Can this org actually deliver via WhatsApp right now? (all four gates) */
export function isWhatsappAvailableForOrg(orgId) {
  if (!isWhatsappEnabledPlatform()) return false;
  const e = entryOf(orgId);
  return e.enabled && hasRequired(e.fields);
}

// ── Admin/owner-facing helpers (never expose raw secrets) ────────────────────

export function maskSecret(v) {
  if (v == null || v === "") return null;
  const s = String(v);
  return s.length <= 4 ? "••••" : "••••" + s.slice(-4);
}

/** Masked view of an org's WhatsApp config for the owner dashboard. */
export function presentOrgWhatsapp(orgId) {
  const e = entryOf(orgId);
  const fields = WHATSAPP_FIELDS.map((f) => {
    const val = e.fields?.[f.key];
    const set = val != null && String(val) !== "";
    return {
      key: f.key,
      label: f.label,
      secret: f.secret,
      required: f.required,
      set,
      preview: f.secret ? maskSecret(val) : set ? String(val) : null,
    };
  });
  return {
    platform_enabled: isWhatsappEnabledPlatform(),
    enabled: e.enabled,
    available: isWhatsappAvailableForOrg(orgId),
    fields,
  };
}

/** Required field labels still missing given a candidate set (post-merge). */
export function missingRequiredFields(fields) {
  return WHATSAPP_FIELDS.filter((f) => f.required)
    .filter((f) => {
      const v = fields?.[f.key];
      return v == null || String(v).trim() === "";
    })
    .map((f) => f.label);
}

/** Validate an incoming partial field set. Returns an error message or null. */
export function validateWhatsappFields(incoming) {
  for (const f of WHATSAPP_FIELDS) {
    if (incoming == null || !(f.key in incoming)) continue;
    const raw = incoming[f.key];
    if (raw == null || String(raw).trim() === "") continue;
    if (String(raw).trim().length > MAX_FIELD_LEN) return `قيمة «${f.label}» طويلة جداً.`;
  }
  return null;
}

/** Merge incoming over existing — blank/missing values preserve existing. */
export function mergeWhatsappFields(existing, incoming) {
  const out = { ...(existing ?? {}) };
  for (const f of WHATSAPP_FIELDS) {
    if (incoming == null || !(f.key in incoming)) continue;
    const raw = incoming[f.key];
    if (raw == null) continue;
    const v = String(raw).trim();
    if (v === "") continue; // blank means "keep current"
    out[f.key] = v;
  }
  return out;
}

/** Read + decrypt the stored fields for an org (owner write path only). */
export async function readStoredFields(orgId) {
  const row = await prisma.whatsappConfig.findUnique({ where: { organizationId: orgId } });
  if (!row) return { fields: {}, enabled: false, exists: false };
  const decoded = decodeRow(row);
  return { fields: decoded.fields, enabled: decoded.enabled, exists: true };
}

/** Encrypt + persist a full field set for an org. */
export async function saveWhatsappConfig(orgId, fields, enabled, updatedById) {
  const secrets = encryptSecret(JSON.stringify(fields));
  await prisma.whatsappConfig.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, enabled, secrets, updatedById },
    update: { enabled, secrets, updatedById },
  });
  await refreshWhatsappConfig(orgId);
}
