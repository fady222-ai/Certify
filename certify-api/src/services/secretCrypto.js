import crypto from "node:crypto";
import { config } from "../config/index.js";

// Authenticated symmetric encryption for secrets stored at rest (payment gateway
// keys). AES-256-GCM gives both confidentiality and tamper detection: a modified
// ciphertext fails the auth-tag check on decrypt instead of yielding garbage.
//
// The 32-byte key is derived from APP_KEY (already validated to be a strong 32+
// char secret in production — see config/index.js). This means the database
// alone is useless to an attacker without APP_KEY (which lives only in the
// server environment), and rotating APP_KEY invalidates stored ciphertexts.
const ALGO = "aes-256-gcm";
const KEY = crypto.createHash("sha256").update(config.appKey).digest(); // 32 bytes

/** Encrypt a UTF-8 string → "iv.tag.ciphertext" (all base64). */
export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

/** Decrypt a blob produced by encryptSecret. Throws on tampering or wrong key. */
export function decryptSecret(blob) {
  const [ivB64, tagB64, dataB64] = String(blob).split(".");
  if (!ivB64 || !tagB64 || dataB64 == null) throw new Error("malformed ciphertext");
  const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
