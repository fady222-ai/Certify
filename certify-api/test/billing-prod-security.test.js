// Locks in the documented production guarantee: when a gateway webhook secret is
// NOT configured, the verifier must REJECT the webhook in production (rather than
// silently trusting a forged payload, which is only tolerated in dev).
//
// This runs in its own file so it can boot `config` in production mode with the
// gateway secrets intentionally unset. NODE_ENV=production makes config refuse to
// boot without a strong APP_KEY, so we provide one. Modules are dynamically
// imported after the env is set (config reads env at load time).

process.env.NODE_ENV = "production";
process.env.APP_KEY = "x".repeat(40); // satisfy config's production APP_KEY check
delete process.env.TAP_WEBHOOK_SECRET;
delete process.env.PAYMOB_HMAC_SECRET;

import { test } from "node:test";
import assert from "node:assert/strict";

const { verifyWebhookSignature } = await import("../src/services/tapService.js");
const { verifyHmac } = await import("../src/services/paymobService.js");

test("production: an unconfigured Tap secret rejects every webhook (no implicit trust)", () => {
  assert.equal(verifyWebhookSignature("any-body", "any-signature"), false);
});

test("production: an unconfigured Paymob secret rejects every webhook", () => {
  assert.equal(verifyHmac({ success: true }, "any-hmac"), false);
});
