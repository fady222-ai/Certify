import crypto from "node:crypto";
import { encryptSecret } from "./secretCrypto.js";

// API keys follow the Stripe/SendGrid convention: a recognizable prefix + a
// high-entropy random secret, shown to the user exactly once. We persist only
// the SHA-256 hash (unique, O(1) lookup) plus an AES-GCM copy for auditing, and
// a masked preview (prefix + last4). The raw key never touches the DB in clear.
const PREFIX = "cfy_live";

/** SHA-256 hex of a raw key — the stored, searchable fingerprint. */
export function hashApiKey(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

/** Generate a fresh API key and everything needed to store/display it. */
export function generateApiKey() {
  const secret = crypto.randomBytes(24).toString("base64url"); // ~32 url-safe chars
  const raw = `${PREFIX}_${secret}`;
  return {
    raw,
    keyHash: hashApiKey(raw),
    keyEnc: encryptSecret(raw),
    prefix: PREFIX,
    last4: raw.slice(-4),
  };
}

/** Masked display form, e.g. "cfy_live_••••3a9f". */
export function maskApiKey({ prefix, last4 }) {
  return `${prefix}_••••${last4}`;
}

/** Shape an ApiKey row for the API (never exposes the raw/encrypted key). */
export function presentApiKey(k) {
  return {
    id: k.id,
    name: k.name,
    masked: maskApiKey(k),
    last_used_at: k.lastUsedAt,
    revoked: !!k.revokedAt,
    created_at: k.createdAt,
  };
}
