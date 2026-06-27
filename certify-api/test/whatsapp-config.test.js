// Tests for the WhatsApp delivery config: encryption round-trip, masking
// (access token never leaks), partial-update merge, validation, and the
// four-gate availability (platform flag + org flag + required fields + cache).
// Prisma is faked in-memory; no DB or network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/db/prisma.js";
import { encryptSecret } from "../src/services/secretCrypto.js";
import {
  maskSecret,
  mergeWhatsappFields,
  validateWhatsappFields,
  missingRequiredFields,
  presentOrgWhatsapp,
  isWhatsappAvailableForOrg,
  whatsappCredentials,
  refreshWhatsappConfig,
} from "../src/services/whatsappConfig.js";
import { setWhatsappEnabledPlatform, isWhatsappEnabledPlatform } from "../src/services/platformSettings.js";

const ORG = "org-1";

async function platform(enabled) {
  prisma.platformSetting = { upsert: async () => ({}) };
  await setWhatsappEnabledPlatform(enabled);
}

async function setOrgRow(row) {
  prisma.whatsappConfig = { findUnique: async ({ where }) => (where.organizationId === ORG ? row : null) };
  await refreshWhatsappConfig(ORG);
}

test("maskSecret hides all but the last 4; null for empty", () => {
  assert.equal(maskSecret("EAAG_longtoken_5678"), "••••5678");
  assert.equal(maskSecret(""), null);
  assert.equal(maskSecret(null), null);
});

test("mergeWhatsappFields: blank/omitted keeps the stored value", () => {
  const existing = { phoneNumberId: "111", accessToken: "tok_old", templateName: "cert" };
  const merged = mergeWhatsappFields(existing, { accessToken: "", templateName: "cert_v2" });
  assert.equal(merged.accessToken, "tok_old"); // blank → kept
  assert.equal(merged.templateName, "cert_v2"); // changed
  assert.equal(merged.phoneNumberId, "111"); // omitted → kept
});

test("validate + missingRequiredFields", () => {
  assert.equal(validateWhatsappFields({ phoneNumberId: "1" }), null);
  assert.match(validateWhatsappFields({ accessToken: "x".repeat(3000) }) ?? "", /طويلة/);
  assert.deepEqual(missingRequiredFields({ phoneNumberId: "1", accessToken: "t", templateName: "c" }), []);
  assert.ok(missingRequiredFields({ phoneNumberId: "1" }).length >= 2);
});

test("availability needs all four gates; secrets stay masked in the view", async () => {
  const secrets = encryptSecret(JSON.stringify({
    phoneNumberId: "100200300", accessToken: "EAAG_secret_9876", templateName: "certificate_ar", languageCode: "ar",
  }));

  // Platform off → never available, even with a fully-configured enabled org.
  await platform(false);
  await setOrgRow({ organizationId: ORG, enabled: true, secrets });
  assert.equal(isWhatsappAvailableForOrg(ORG), false);

  // Platform on + org enabled + required fields present → available.
  await platform(true);
  assert.equal(isWhatsappEnabledPlatform(), true);
  assert.equal(isWhatsappAvailableForOrg(ORG), true);
  assert.equal(whatsappCredentials(ORG).accessToken, "EAAG_secret_9876"); // sender sees real value

  const view = presentOrgWhatsapp(ORG);
  assert.equal(view.platform_enabled, true);
  assert.equal(view.available, true);
  const tok = view.fields.find((f) => f.key === "accessToken");
  assert.equal(tok.preview, "••••9876");
  assert.ok(!JSON.stringify(view).includes("EAAG_secret_9876"), "raw token must never appear in the view");

  // Org toggles itself off → not available.
  await setOrgRow({ organizationId: ORG, enabled: false, secrets });
  assert.equal(isWhatsappAvailableForOrg(ORG), false);

  // Enabled but missing required creds → not available.
  await setOrgRow({ organizationId: ORG, enabled: true, secrets: encryptSecret(JSON.stringify({ phoneNumberId: "1" })) });
  assert.equal(isWhatsappAvailableForOrg(ORG), false);

  // Cleanup so other test files start clean.
  await platform(false);
  await setOrgRow(null);
});
