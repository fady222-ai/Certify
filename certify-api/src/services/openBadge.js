import crypto from "node:crypto";
import { config } from "../config/index.js";
import { verifyUrl } from "./certificateRenderer.js";

/**
 * Open Badges 3.0 issuer — turns a certificate into a W3C Verifiable Credential
 * (OpenBadgeCredential) and signs it as a VC-JWT (EdDSA / Ed25519).
 *
 * VC-JWT is the simplest standards-compliant proof for OB 3.0: the credential is
 * the JWS payload, signed with the issuer's Ed25519 key, and verifiers fetch the
 * public key from the issuer's JWKS (referenced by the JWT `kid`). This avoids
 * RDF dataset canonicalization (needed for embedded Data Integrity proofs) while
 * staying interoperable — pure node:crypto, no extra dependencies.
 */

// JSON-LD contexts: W3C VC Data Model 2.0 + the official 1EdTech OB 3.0 context.
export const VC_CONTEXT = "https://www.w3.org/ns/credentials/v2";
export const OB_CONTEXT = "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json";

const API_BASE = config.appUrl.replace(/\/$/, "");

function base64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

// PKCS8 DER prefix for an Ed25519 private key, followed by the 32-byte seed.
// Lets us build a *deterministic* key from a seed without any external library.
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

let cachedKeys = null;

/**
 * Resolve the issuer Ed25519 key pair. Uses OB_SIGNING_KEY (PKCS8 PEM) when set,
 * otherwise derives a stable key from APP_KEY so credentials stay verifiable
 * across restarts. Cached after first use.
 */
export function issuerKeys() {
  if (cachedKeys) return cachedKeys;

  let privateKey;
  if (config.obSigningKey) {
    privateKey = crypto.createPrivateKey({ key: config.obSigningKey, format: "pem" });
    if (privateKey.asymmetricKeyType !== "ed25519") {
      throw new Error("OB_SIGNING_KEY must be an Ed25519 private key (PKCS8 PEM).");
    }
  } else {
    const seed = crypto.createHash("sha256").update(`${config.appKey}|openbadge-ed25519`).digest();
    privateKey = crypto.createPrivateKey({
      key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
      format: "der",
      type: "pkcs8",
    });
  }

  const publicKey = crypto.createPublicKey(privateKey);
  const jwk = publicKey.export({ format: "jwk" }); // { kty:"OKP", crv:"Ed25519", x:"..." }
  // Stable key id derived from the public key material (changes if the key rotates).
  const kid = crypto.createHash("sha256").update(jwk.x).digest("base64url").slice(0, 16);

  cachedKeys = { privateKey, publicKey, jwk, kid };
  return cachedKeys;
}

/** Public issuer profile (OB 3.0 Profile) — identifies who signs the credentials. */
export function issuerProfile(org) {
  const profile = {
    "@context": [VC_CONTEXT, OB_CONTEXT],
    id: issuerId(),
    type: ["Profile"],
    name: org?.name || "Certify",
  };
  if (org?.logoUrl) {
    profile.image = { id: assetUrl(org.logoUrl), type: "Image" };
  }
  return profile;
}

/** Public JWKS document so verifiers can check the VC-JWT signature. */
export function issuerJwks() {
  const { jwk, kid } = issuerKeys();
  return {
    keys: [{ kty: jwk.kty, crv: jwk.crv, x: jwk.x, use: "sig", alg: "EdDSA", kid }],
  };
}

export function issuerId() {
  return `${API_BASE}/api/credentials/issuer`;
}

function jwksUrl() {
  return `${API_BASE}/api/credentials/issuer/jwks.json`;
}

function assetUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}/storage/${url}`;
}

function toIso(date) {
  if (!date) return null;
  return (date instanceof Date ? date : new Date(date)).toISOString();
}

/**
 * Build an unsigned OpenBadgeCredential (W3C VC 2.0 + OB 3.0) from a certificate
 * record (with its `organization` relation included).
 */
export function buildCredential(cert, org) {
  const credentialId = `${verifyUrl(cert.verificationCode)}#openbadge`;
  const achievementName = cert.courseName?.trim() || "شهادة إتمام";

  const subject = {
    type: ["AchievementSubject"],
    name: cert.recipientName,
    achievement: {
      id: verifyUrl(cert.verificationCode),
      type: ["Achievement"],
      name: achievementName,
      description: org?.name
        ? `${achievementName} — صادرة عن ${org.name}.`
        : achievementName,
      criteria: { narrative: `إتمام ${achievementName} بنجاح.` },
    },
  };

  // Recipient email as a (cleartext) IdentityObject when present — lets wallets
  // bind the credential to the holder.
  if (cert.recipientEmail) {
    subject.identifier = [
      {
        type: "IdentityObject",
        identityType: "emailAddress",
        hashed: false,
        identityHash: cert.recipientEmail,
      },
    ];
  }

  const credential = {
    "@context": [VC_CONTEXT, OB_CONTEXT],
    id: credentialId,
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    name: achievementName,
    issuer: issuerProfile(org),
    validFrom: toIso(cert.issueDate),
    credentialSubject: subject,
  };
  const validUntil = toIso(cert.expiryDate);
  if (validUntil) credential.validUntil = validUntil;

  return credential;
}

/**
 * Sign a credential as a compact VC-JWT (EdDSA). The credential object is the
 * JWS payload; the header references the issuer JWKS via `kid`.
 */
export function signCredentialJwt(credential) {
  const { privateKey, kid } = issuerKeys();
  const header = { alg: "EdDSA", typ: "vc+jwt", kid: `${jwksUrl()}#${kid}` };

  const signingInput =
    base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(credential));
  // Ed25519: the algorithm argument to sign/verify must be null.
  const signature = crypto.sign(null, Buffer.from(signingInput), privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

/** Verify a compact VC-JWT against the issuer key. Returns the payload or null. */
export function verifyCredentialJwt(token) {
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const { publicKey } = issuerKeys();
  const signingInput = `${parts[0]}.${parts[1]}`;
  let signature;
  try {
    signature = Buffer.from(parts[2], "base64url");
  } catch {
    return null;
  }
  const ok = crypto.verify(null, Buffer.from(signingInput), publicKey, signature);
  if (!ok) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
