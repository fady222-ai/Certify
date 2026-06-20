import crypto from "node:crypto";

// Self-contained TOTP (RFC 6238) — avoids a third-party dependency. Defaults
// match every standard authenticator app: 30-second step, 6 digits, SHA-1.
const STEP_SECONDS = 30;
const DIGITS = 6;
const ALGO = "sha1";
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Encode bytes to RFC 4648 base32 (no padding) — the format authenticators expect. */
export function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Decode a base32 string (case-insensitive, ignores spaces/padding) to bytes. */
export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/=+$/,"").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh random base32 secret (160 bits, the recommended TOTP seed length). */
export function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

/** The HOTP value for a given counter (RFC 4226 dynamic truncation). */
function hotp(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac(ALGO, secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** Generate the current TOTP code for a base32 secret (used in tests/manual). */
export function generate(secret, forTime = Date.now()) {
  const counter = Math.floor(forTime / 1000 / STEP_SECONDS);
  return hotp(base32Decode(secret), counter);
}

/**
 * Verify a submitted code against the secret, tolerating ±`window` steps of
 * clock drift. Constant-time per-candidate compare. Returns true/false.
 */
export function verify(token, secret, { window = 1, forTime = Date.now() } = {}) {
  const code = String(token ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const secretBuf = base32Decode(secret);
  const counter = Math.floor(forTime / 1000 / STEP_SECONDS);
  for (let i = -window; i <= window; i++) {
    const candidate = hotp(secretBuf, counter + i);
    if (candidate.length === code.length &&
        crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(code))) {
      return true;
    }
  }
  return false;
}

/** Build the otpauth:// URI an authenticator app scans from a QR code. */
export function keyuri(accountName, secret, issuer = "Certify") {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}
