import { config } from "../config/index.js";
import { prisma } from "../db/prisma.js";
import { encryptSecret, decryptSecret } from "./secretCrypto.js";

// ─────────────────────────────────────────────────────────────────────────────
// Payment-gateway credential resolver.
//
// Credentials can come from TWO sources, in priority order:
//   1. The database (set by an admin via the dashboard) — encrypted at rest.
//   2. Environment variables (the original mechanism) — used as a fallback.
//
// Admin-set DB values override env so the platform owner can rotate keys without
// a redeploy. The decrypted DB values are cached in memory (populated at boot,
// refreshed on every admin write) so the hot path (checkout / webhook handling)
// stays synchronous and never hits the DB per request. Raw secrets never leave
// the server: the admin API only ever returns masked previews (see maskSecret).
// ─────────────────────────────────────────────────────────────────────────────

// Field metadata per gateway. `env` maps to the fallback key on `config`.
// `secret: true` fields are never returned in full to the client (masked only).
export const GATEWAY_SPECS = {
  stripe: {
    label: "Stripe",
    region: "عالمي",
    fields: [
      { key: "secretKey", label: "Secret Key", secret: true, required: true, env: "stripeSecretKey" },
      { key: "webhookSecret", label: "Webhook Secret", secret: true, required: false, env: "stripeWebhookSecret" },
    ],
  },
  tap: {
    label: "Tap",
    region: "الخليج",
    fields: [
      { key: "secretKey", label: "Secret Key", secret: true, required: true, env: "tapSecretKey" },
      { key: "webhookSecret", label: "Webhook Secret", secret: true, required: false, env: "tapWebhookSecret" },
    ],
  },
  paymob: {
    label: "Paymob",
    region: "مصر",
    fields: [
      { key: "apiKey", label: "API Key", secret: true, required: true, env: "paymobApiKey" },
      { key: "integrationId", label: "Integration ID", secret: false, required: true, env: "paymobIntegrationId" },
      { key: "iframeId", label: "Iframe ID", secret: false, required: true, env: "paymobIframeId" },
      { key: "hmacSecret", label: "HMAC Secret", secret: true, required: false, env: "paymobHmacSecret" },
      { key: "egpRate", label: "سعر صرف USD→EGP", secret: false, required: false, numeric: true, env: "paymobEgpRate" },
    ],
  },
};

// gateway -> { enabled: bool, fields: { key: value } }  (decrypted)
const cache = new Map();

function decodeRow(row) {
  let fields = {};
  try {
    fields = JSON.parse(decryptSecret(row.secrets));
  } catch (e) {
    // A decrypt failure (e.g. APP_KEY rotated) must not crash billing — log and
    // fall back to env for this gateway.
    console.error(`[gatewayConfig] decrypt failed for ${row.gateway}:`, e.message);
  }
  return { enabled: row.enabled, fields };
}

/** Load all admin-set gateway configs into the in-memory cache. Call at boot. */
export async function loadGatewayConfigs() {
  try {
    const rows = await prisma.gatewayConfig.findMany();
    cache.clear();
    for (const row of rows) cache.set(row.gateway, decodeRow(row));
    if (rows.length) console.log(`[gatewayConfig] loaded ${rows.length} gateway config(s) from DB`);
  } catch (e) {
    // Table may not exist yet (pre-migration) — silently fall back to env.
    console.error("[gatewayConfig] load skipped:", e.message);
  }
}

/** Refresh a single gateway's cached config after an admin write/delete. */
export async function refreshGatewayConfig(gateway) {
  const row = await prisma.gatewayConfig.findUnique({ where: { gateway } });
  if (!row) cache.delete(gateway);
  else cache.set(gateway, decodeRow(row));
}

// Resolve effective values for a gateway: DB cache (if set) over env fallback.
function resolved(gateway) {
  const spec = GATEWAY_SPECS[gateway];
  const entry = cache.get(gateway);
  const out = { __enabled: entry ? entry.enabled : true, __hasDbRow: !!entry };
  for (const f of spec.fields) {
    const dbVal = entry?.fields?.[f.key];
    out[f.key] = dbVal != null && dbVal !== "" ? dbVal : config[f.env];
  }
  return out;
}

// ── Resolved getters consumed by the gateway services ────────────────────────
export function stripeConfig() {
  const r = resolved("stripe");
  return { secretKey: r.secretKey || "", webhookSecret: r.webhookSecret || "" };
}
export function tapConfig() {
  const r = resolved("tap");
  return { secretKey: r.secretKey || "", webhookSecret: r.webhookSecret || "" };
}
export function paymobConfig() {
  const r = resolved("paymob");
  return {
    apiKey: r.apiKey || "",
    integrationId: r.integrationId || "",
    iframeId: r.iframeId || "",
    hmacSecret: r.hmacSecret || "",
    egpRate: parseFloat(r.egpRate) || config.paymobEgpRate,
  };
}

/** A gateway is available for checkout when enabled and all required fields set. */
export function isGatewayAvailable(gateway) {
  const r = resolved(gateway);
  if (!r.__enabled) return false;
  return GATEWAY_SPECS[gateway].fields.filter((f) => f.required).every((f) => !!r[f.key]);
}

// ── Admin-facing helpers (never expose raw secrets) ──────────────────────────

/** Mask a secret to a short non-reversible preview, e.g. "••••1234". */
export function maskSecret(v) {
  if (v == null || v === "") return null;
  const s = String(v);
  return s.length <= 4 ? "••••" : "••••" + s.slice(-4);
}

/** Build the admin view for one gateway — masks secrets, shows non-secret values. */
export function presentGateway(gateway) {
  const spec = GATEWAY_SPECS[gateway];
  const entry = cache.get(gateway);
  const r = resolved(gateway);
  const fields = spec.fields.map((f) => {
    const val = r[f.key];
    const set = val != null && String(val) !== "";
    return {
      key: f.key,
      label: f.label,
      secret: f.secret,
      required: f.required,
      set,
      // Secret fields: masked preview only. Non-secret fields: full value (ids/rate).
      preview: f.secret ? maskSecret(val) : set ? String(val) : null,
    };
  });
  const source = entry ? "db" : spec.fields.some((f) => f.required && config[f.env]) ? "env" : "none";
  return {
    gateway,
    label: spec.label,
    region: spec.region,
    enabled: entry ? entry.enabled : true,
    available: isGatewayAvailable(gateway),
    source,
    fields,
  };
}

export function presentAllGateways() {
  return Object.keys(GATEWAY_SPECS).map(presentGateway);
}

/** Validate an incoming partial field set. Returns an error message or null. */
export function validateGatewayFields(gateway, incoming) {
  const spec = GATEWAY_SPECS[gateway];
  if (!spec) return "بوابة غير معروفة.";
  for (const f of spec.fields) {
    if (incoming == null || !(f.key in incoming)) continue;
    const raw = incoming[f.key];
    if (raw == null || String(raw).trim() === "") continue;
    const v = String(raw).trim();
    if (f.numeric && !(parseFloat(v) > 0)) return `قيمة «${f.label}» يجب أن تكون رقماً موجباً.`;
  }
  if (gateway === "stripe") {
    const sk = incoming?.secretKey?.trim?.();
    if (sk && !/^(sk|rk)_/.test(sk)) return "مفتاح Stripe السري يجب أن يبدأ بـ sk_ أو rk_.";
    const wh = incoming?.webhookSecret?.trim?.();
    if (wh && !/^whsec_/.test(wh)) return "سر Stripe webhook يجب أن يبدأ بـ whsec_.";
  }
  return null;
}

/** Merge incoming fields over existing — blank/missing values preserve existing. */
export function mergeGatewayFields(gateway, existing, incoming) {
  const spec = GATEWAY_SPECS[gateway];
  const out = { ...(existing ?? {}) };
  for (const f of spec.fields) {
    if (incoming == null || !(f.key in incoming)) continue;
    const raw = incoming[f.key];
    if (raw == null) continue;
    const v = String(raw).trim();
    if (v === "") continue; // blank means "keep current"
    out[f.key] = v;
  }
  return out;
}

/** Read + decrypt the stored fields for a gateway (admin write path only). */
export async function readStoredFields(gateway) {
  const row = await prisma.gatewayConfig.findUnique({ where: { gateway } });
  if (!row) return { fields: {}, enabled: true, exists: false };
  const decoded = decodeRow(row);
  return { fields: decoded.fields, enabled: decoded.enabled, exists: true };
}

/** Encrypt + persist a full field set for a gateway. */
export async function saveGatewayConfig(gateway, fields, enabled, updatedById) {
  const secrets = encryptSecret(JSON.stringify(fields));
  await prisma.gatewayConfig.upsert({
    where: { gateway },
    create: { gateway, enabled, secrets, updatedById },
    update: { enabled, secrets, updatedById },
  });
  await refreshGatewayConfig(gateway);
}

export async function deleteGatewayConfig(gateway) {
  await prisma.gatewayConfig.deleteMany({ where: { gateway } });
  await refreshGatewayConfig(gateway);
}
