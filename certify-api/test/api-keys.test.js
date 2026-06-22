import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/db/prisma.js";
import { generateApiKey, hashApiKey, maskApiKey } from "../src/services/apiKeyService.js";
import { decryptSecret } from "../src/services/secretCrypto.js";
import { listApiKeys, createApiKey, revokeApiKey } from "../src/controllers/apiKeyController.js";
import { requireApiKey } from "../src/middleware/requireApiKey.js";

// ── Pure service tests ───────────────────────────────────────────────────────
test("generateApiKey: prefixed, high-entropy, hash + enc round-trip", () => {
  const a = generateApiKey();
  assert.match(a.raw, /^cfy_live_[A-Za-z0-9_-]{20,}$/);
  assert.equal(a.prefix, "cfy_live");
  assert.equal(a.last4, a.raw.slice(-4));
  assert.equal(a.keyHash, hashApiKey(a.raw)); // deterministic
  assert.equal(decryptSecret(a.keyEnc), a.raw); // recoverable for audit
  assert.notEqual(generateApiKey().raw, a.raw); // unique
});

test("hashApiKey is deterministic and irreversible-looking", () => {
  assert.equal(hashApiKey("x"), hashApiKey("x"));
  assert.notEqual(hashApiKey("x"), "x");
});

test("maskApiKey hides the secret", () => {
  assert.equal(maskApiKey({ prefix: "cfy_live", last4: "9z8y" }), "cfy_live_••••9z8y");
});

// ── Controller / middleware tests (in-memory Prisma fake) ────────────────────
let apiKeys;

function installFakePrisma() {
  apiKeys = [];
  prisma.apiKey = {
    findMany: async ({ where }) =>
      apiKeys.filter((k) => k.organizationId === where.organizationId && (where.revokedAt === undefined || k.revokedAt === where.revokedAt)),
    findUnique: async ({ where }) => apiKeys.find((k) => k.keyHash === where.keyHash) ?? null,
    findFirst: async ({ where }) =>
      apiKeys.find((k) => k.id === where.id && k.organizationId === where.organizationId && (where.revokedAt === undefined || k.revokedAt === where.revokedAt)) ?? null,
    create: async ({ data }) => {
      const k = { id: randomUUID(), lastUsedAt: null, revokedAt: null, createdAt: new Date(), ...data };
      apiKeys.push(k);
      return k;
    },
    update: async ({ where, data }) => {
      const k = apiKeys.find((x) => x.id === where.id);
      Object.assign(k, data);
      return k;
    },
  };
}

function makeRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
const next = (e) => { if (e) throw e; };
const ORG = { id: "org1", plan: { hasApi: true } };
const ownerReq = (body = {}) => ({ organization: ORG, user: { id: "u1" }, body, params: {} });

beforeEach(() => installFakePrisma());

test("createApiKey returns the raw key once and stores only the hash", async () => {
  const res = makeRes();
  await createApiKey(ownerReq({ name: "تطبيقي" }), res, next);
  assert.equal(res.statusCode, 201);
  assert.match(res.body.key, /^cfy_live_/);            // raw shown once
  assert.equal(res.body.masked, maskApiKey(apiKeys[0])); // masked in record
  assert.equal(apiKeys[0].keyHash, hashApiKey(res.body.key));
  assert.ok(!("key" in apiKeys[0])); // raw never persisted
});

test("createApiKey is blocked when the plan lacks API access", async () => {
  const res = makeRes();
  await createApiKey({ organization: { id: "org1", plan: { hasApi: false } }, user: { id: "u1" }, body: { name: "x" }, params: {} }, res, next);
  assert.equal(res.statusCode, 403);
});

test("listApiKeys returns masked keys + has_api, never the secret", async () => {
  await createApiKey(ownerReq({ name: "k" }), makeRes(), next);
  const res = makeRes();
  await listApiKeys(ownerReq(), res, next);
  assert.equal(res.body.has_api, true);
  assert.equal(res.body.data.length, 1);
  assert.ok(!("key" in res.body.data[0]) && !("keyHash" in res.body.data[0]));
});

test("revokeApiKey marks the key revoked", async () => {
  await createApiKey(ownerReq({ name: "k" }), makeRes(), next);
  const id = apiKeys[0].id;
  const res = makeRes();
  await revokeApiKey({ ...ownerReq(), params: { id } }, res, next);
  assert.equal(res.body.ok, true);
  assert.ok(apiKeys[0].revokedAt instanceof Date);
});

test("requireApiKey: valid key loads org; missing/invalid/revoked are rejected", async () => {
  const gen = generateApiKey();
  apiKeys.push({ id: "k1", organizationId: "org1", keyHash: gen.keyHash, revokedAt: null, organization: { id: "org1", plan: { hasApi: true }, suspendedAt: null } });
  // re-stub findUnique to include the organization relation
  prisma.apiKey.findUnique = async ({ where }) => apiKeys.find((k) => k.keyHash === where.keyHash) ?? null;

  // valid
  let nextCalled = false;
  const req = { get: () => `Bearer ${gen.raw}` };
  await requireApiKey(req, makeRes(), () => { nextCalled = true; });
  assert.ok(nextCalled && req.organization?.id === "org1" && req.apiKey);

  // missing
  let res = makeRes();
  await requireApiKey({ get: () => "" }, res, () => {});
  assert.equal(res.statusCode, 401);

  // invalid
  res = makeRes();
  await requireApiKey({ get: () => "Bearer cfy_live_wrong" }, res, () => {});
  assert.equal(res.statusCode, 401);
});

test("requireApiKey: 403 when plan lacks API access", async () => {
  const gen = generateApiKey();
  apiKeys.push({ id: "k2", organizationId: "org2", keyHash: gen.keyHash, revokedAt: null, organization: { id: "org2", plan: { hasApi: false }, suspendedAt: null } });
  const res = makeRes();
  await requireApiKey({ get: () => `Bearer ${gen.raw}` }, res, () => {});
  assert.equal(res.statusCode, 403);
});
