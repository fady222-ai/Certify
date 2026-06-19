// Tests for admin-managed payment gateway credentials: encryption round-trip,
// masking (secrets never leak), partial-update merge, validation, and the
// DB-overrides-env resolver. Prisma is faked in-memory; no DB or network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/db/prisma.js";
import { encryptSecret, decryptSecret } from "../src/services/secretCrypto.js";
import {
  maskSecret,
  mergeGatewayFields,
  validateGatewayFields,
  missingRequiredFields,
  presentGateway,
  stripeConfig,
  isGatewayAvailable,
  refreshGatewayConfig,
} from "../src/services/gatewayConfig.js";

// ── secretCrypto ─────────────────────────────────────────────────────────────
test("secretCrypto: round-trips and detects tampering", () => {
  const blob = encryptSecret("sk_live_supersecret");
  assert.equal(decryptSecret(blob), "sk_live_supersecret");

  const [iv, tag] = blob.split(".");
  const forged = [iv, tag, Buffer.from("tampered").toString("base64")].join(".");
  assert.throws(() => decryptSecret(forged), "modified ciphertext must fail the auth tag");
});

test("secretCrypto: round-trips a JSON field blob", () => {
  const fields = { secretKey: "sk_test_123", webhookSecret: "whsec_abc" };
  assert.deepEqual(JSON.parse(decryptSecret(encryptSecret(JSON.stringify(fields)))), fields);
});

// ── masking ──────────────────────────────────────────────────────────────────
test("maskSecret: shows only the last 4 chars, null for empty", () => {
  assert.equal(maskSecret("sk_live_ABCD1234"), "••••1234");
  assert.equal(maskSecret("abc"), "••••");
  assert.equal(maskSecret(""), null);
  assert.equal(maskSecret(null), null);
});

// ── partial merge ────────────────────────────────────────────────────────────
test("mergeGatewayFields: blank/omitted values keep the stored secret", () => {
  const existing = { secretKey: "sk_old", webhookSecret: "whsec_old" };
  // admin only re-typed the webhook secret; secretKey left blank
  const merged = mergeGatewayFields("stripe", existing, { secretKey: "", webhookSecret: "whsec_new" });
  assert.equal(merged.secretKey, "sk_old", "blank field preserved");
  assert.equal(merged.webhookSecret, "whsec_new", "provided field updated");
});

test("mergeGatewayFields: trims and ignores unknown keys", () => {
  const merged = mergeGatewayFields("tap", {}, { secretKey: "  sk_tap  ", bogus: "x" });
  assert.equal(merged.secretKey, "sk_tap");
  assert.equal(merged.bogus, undefined);
});

// ── validation ───────────────────────────────────────────────────────────────
test("validateGatewayFields: enforces Stripe key prefixes and numeric rate", () => {
  assert.match(validateGatewayFields("stripe", { secretKey: "nope" }), /sk_/);
  assert.match(validateGatewayFields("stripe", { webhookSecret: "nope" }), /whsec_/);
  assert.equal(validateGatewayFields("stripe", { secretKey: "sk_live_ok", webhookSecret: "whsec_ok" }), null);
  assert.match(validateGatewayFields("paymob", { egpRate: "-5" }), /رقم/);
  assert.equal(validateGatewayFields("paymob", { egpRate: "50.5" }), null);
});

test("validateGatewayFields: rejects an over-long field, accepts one within the cap", () => {
  assert.equal(validateGatewayFields("stripe", { secretKey: "sk_" + "a".repeat(1000) }), null);
  assert.match(validateGatewayFields("stripe", { secretKey: "sk_" + "a".repeat(2000) }), /طويلة/);
});

test("missingRequiredFields: lists required fields absent after merge (guards enabling)", () => {
  // Stripe's only required field is the Secret Key.
  assert.deepEqual(missingRequiredFields("stripe", {}), ["Secret Key"]);
  assert.deepEqual(missingRequiredFields("stripe", { secretKey: "sk_live_x" }), []);
  // Blank/whitespace does not satisfy a required field.
  assert.deepEqual(missingRequiredFields("stripe", { secretKey: "   " }), ["Secret Key"]);
  // Paymob has three required fields; providing one leaves the other two.
  assert.deepEqual(
    missingRequiredFields("paymob", { apiKey: "x" }),
    ["Integration ID", "Iframe ID"],
  );
});

// ── resolver + presentation (DB overrides env, secrets never leak) ────────────
test("admin-set credentials override env, resolve internally, and mask in the API view", async () => {
  prisma.gatewayConfig = {
    findUnique: async ({ where }) =>
      where.gateway === "stripe"
        ? {
            gateway: "stripe",
            enabled: true,
            secrets: encryptSecret(JSON.stringify({ secretKey: "sk_live_ZZZZ9876", webhookSecret: "whsec_qqqq4321" })),
          }
        : null,
  };
  await refreshGatewayConfig("stripe");

  // Internal resolver returns the real value (services need it to call Stripe).
  assert.equal(stripeConfig().secretKey, "sk_live_ZZZZ9876");
  assert.equal(isGatewayAvailable("stripe"), true);

  // Admin-facing view masks the secret and never contains the raw value anywhere.
  const view = presentGateway("stripe");
  const sk = view.fields.find((f) => f.key === "secretKey");
  assert.equal(sk.set, true);
  assert.equal(sk.preview, "••••9876");
  assert.equal(view.source, "db");
  assert.ok(!JSON.stringify(view).includes("sk_live_ZZZZ9876"), "raw secret must never appear in the view");

  // Cleanup: clear the cached row so other test files start clean.
  prisma.gatewayConfig = { findUnique: async () => null };
  await refreshGatewayConfig("stripe");
});

test("a disabled gateway is not available even with credentials present", async () => {
  prisma.gatewayConfig = {
    findUnique: async () => ({
      gateway: "tap",
      enabled: false,
      secrets: encryptSecret(JSON.stringify({ secretKey: "sk_tap_live" })),
    }),
  };
  await refreshGatewayConfig("tap");
  assert.equal(isGatewayAvailable("tap"), false);

  prisma.gatewayConfig = { findUnique: async () => null };
  await refreshGatewayConfig("tap");
});
