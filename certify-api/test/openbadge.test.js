import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCredential,
  signCredentialJwt,
  verifyCredentialJwt,
  issuerJwks,
  issuerKeys,
  VC_CONTEXT,
  OB_CONTEXT,
} from "../src/services/openBadge.js";

// A minimal certificate + organization stand-in (no DB needed).
const cert = {
  id: "cert-1",
  verificationCode: "ABC123",
  recipientName: "أحمد محمد",
  recipientEmail: "ahmed@example.com",
  courseName: "أساسيات الأمن السيبراني",
  issueDate: new Date("2026-01-15T00:00:00.000Z"),
  expiryDate: new Date("2028-01-15T00:00:00.000Z"),
  status: "active",
};
const org = { name: "أكاديمية المستقبل", logoUrl: "logo.png" };

test("buildCredential produces an OB 3.0 / W3C VC structure", () => {
  const vc = buildCredential(cert, org);
  assert.deepEqual(vc["@context"], [VC_CONTEXT, OB_CONTEXT]);
  assert.deepEqual(vc.type, ["VerifiableCredential", "OpenBadgeCredential"]);
  assert.equal(vc.issuer.type[0], "Profile");
  assert.equal(vc.issuer.name, org.name);
  assert.equal(vc.validFrom, "2026-01-15T00:00:00.000Z");
  assert.equal(vc.validUntil, "2028-01-15T00:00:00.000Z");
  assert.deepEqual(vc.credentialSubject.type, ["AchievementSubject"]);
  assert.equal(vc.credentialSubject.name, "أحمد محمد");
  assert.equal(vc.credentialSubject.achievement.name, "أساسيات الأمن السيبراني");
  // Email bound as a cleartext IdentityObject.
  assert.equal(vc.credentialSubject.identifier[0].identityHash, "ahmed@example.com");
});

test("buildCredential omits validUntil and identifier when absent", () => {
  const vc = buildCredential(
    { ...cert, expiryDate: null, recipientEmail: null },
    org,
  );
  assert.equal(vc.validUntil, undefined);
  assert.equal(vc.credentialSubject.identifier, undefined);
});

test("buildCredential falls back to a default achievement name", () => {
  const vc = buildCredential({ ...cert, courseName: null }, org);
  assert.equal(vc.credentialSubject.achievement.name, "شهادة إتمام");
});

test("signCredentialJwt yields a compact JWS with an EdDSA header", () => {
  const token = signCredentialJwt(buildCredential(cert, org));
  const parts = token.split(".");
  assert.equal(parts.length, 3);
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  assert.equal(header.alg, "EdDSA");
  assert.equal(header.typ, "vc+jwt");
  assert.match(header.kid, /jwks\.json#/);
});

test("verifyCredentialJwt accepts a genuine token and returns the payload", () => {
  const vc = buildCredential(cert, org);
  const payload = verifyCredentialJwt(signCredentialJwt(vc));
  assert.ok(payload);
  assert.deepEqual(payload.type, ["VerifiableCredential", "OpenBadgeCredential"]);
  assert.equal(payload.credentialSubject.name, "أحمد محمد");
});

test("verifyCredentialJwt rejects a tampered payload", () => {
  const token = signCredentialJwt(buildCredential(cert, org));
  const [h, , s] = token.split(".");
  const forged = JSON.stringify({ ...buildCredential(cert, org), name: "مزوّر" });
  const tampered = `${h}.${Buffer.from(forged).toString("base64url")}.${s}`;
  assert.equal(verifyCredentialJwt(tampered), null);
});

test("verifyCredentialJwt rejects malformed input", () => {
  assert.equal(verifyCredentialJwt("not-a-jwt"), null);
  assert.equal(verifyCredentialJwt("a.b"), null);
});

test("issuerKeys is deterministic (stable across calls)", () => {
  const a = issuerKeys();
  const b = issuerKeys();
  assert.equal(a.kid, b.kid);
  assert.equal(a.jwk.x, b.jwk.x);
});

test("issuerJwks exposes an Ed25519 OKP public key", () => {
  const jwks = issuerJwks();
  assert.equal(jwks.keys.length, 1);
  const key = jwks.keys[0];
  assert.equal(key.kty, "OKP");
  assert.equal(key.crv, "Ed25519");
  assert.equal(key.alg, "EdDSA");
  assert.ok(key.x.length > 0);
});
