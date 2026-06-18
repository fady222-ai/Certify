// Integration tests for the billing layer: webhook signature verification,
// webhook handler state transitions, and the scheduled renewal/grace-period
// downgrade logic. These cover OUR code — the part that translates a gateway
// event into a subscription state change — not the gateway's own processing.
//
// The DB is isolated with an in-memory Prisma fake (same approach as
// auth.test.js). Gateway secrets are set BEFORE the modules load: `config`
// reads env at import time, so the service/controller modules are pulled in via
// dynamic import() after the env is in place. Node runs each test file in its
// own process by default, so this env setup does not leak to other files.

process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
process.env.TAP_WEBHOOK_SECRET = "tap_test_secret";
process.env.PAYMOB_HMAC_SECRET = "paymob_test_secret";

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import Stripe from "stripe";

const { verifyWebhookSignature } = await import("../src/services/tapService.js");
const { verifyHmac } = await import("../src/services/paymobService.js");
const { constructWebhookEvent } = await import("../src/services/stripeService.js");
const { handleTapWebhook, handlePaymobWebhook } = await import("../src/controllers/billingWebhookController.js");
const { processRenewals } = await import("../src/jobs/renewSubscriptions.js");
const { prisma } = await import("../src/db/prisma.js");

// ── In-memory Prisma fake ────────────────────────────────────────────────────
let calls;

function installFakePrisma({ subscriptions = [], plans = [], org = null, seenEvents = [] } = {}) {
  calls = { subUpdate: [], subUpdateMany: [], subUpsert: [], orgUpdate: [], webhookEvents: [] };
  const subs = subscriptions;

  // Idempotency store: create throws a P2002-shaped error on a duplicate
  // (gateway,eventId), exactly like the unique constraint in the schema.
  const events = new Set(seenEvents);
  prisma.webhookEvent = {
    create: async ({ data }) => {
      const key = `${data.gateway}:${data.eventId}`;
      if (events.has(key)) { const e = new Error("dup"); e.code = "P2002"; throw e; }
      events.add(key);
      calls.webhookEvents.push(data);
      return { id: "we_" + key, ...data };
    },
  };

  prisma.subscription = {
    // Reads return shallow clones so a caller mutating its result doesn't alter
    // our store (mirrors Prisma returning a snapshot, not a live row).
    findMany: async ({ where }) => subs.filter((s) => matchWhere(s, where)).map((s) => ({ ...s })),
    findFirst: async ({ where }) => {
      const s = subs.find((x) => matchWhere(x, where));
      return s ? { ...s } : null;
    },
    findUnique: async ({ where }) => {
      const s = subs.find((x) => (where.id ? x.id === where.id : x.organizationId === where.organizationId));
      return s ? { ...s } : null;
    },
    update: async ({ where, data }) => {
      calls.subUpdate.push({ where, data });
      const s = subs.find((x) => x.id === where.id);
      if (s) Object.assign(s, data);
      return s;
    },
    updateMany: async ({ where, data }) => {
      calls.subUpdateMany.push({ where, data });
      let count = 0;
      for (const s of subs) if (matchWhere(s, where)) { Object.assign(s, data); count++; }
      return { count };
    },
    upsert: async ({ where, create, update }) => {
      calls.subUpsert.push({ where, create, update });
      const s = subs.find((x) => x.organizationId === where.organizationId);
      if (s) { Object.assign(s, update); return s; }
      const created = { ...create };
      subs.push(created);
      return created;
    },
  };

  prisma.organization = {
    update: async ({ where, data }) => {
      calls.orgUpdate.push({ where, data });
      if (org && org.id === where.id) Object.assign(org, data);
      return org;
    },
  };

  prisma.plan = {
    findUnique: async ({ where }) => plans.find((p) => p.slug === where.slug || p.id === where.id) ?? null,
  };

  prisma.$transaction = async (ops) => Promise.all(ops);
}

// Minimal Prisma `where` matcher: supports equality, null, and the
// { lte | lt | gte | gt | not } operators used by the renewal job.
function matchWhere(rec, where = {}) {
  for (const [k, cond] of Object.entries(where)) {
    const v = rec[k];
    if (cond === null) {
      if (v !== null && v !== undefined) return false;
    } else if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("not" in cond) {
        if (cond.not === null) { if (v === null || v === undefined) return false; }
        else if (v === cond.not) return false;
      }
      if ("lte" in cond && !(cmp(v) <= cmp(cond.lte))) return false;
      if ("lt" in cond && !(cmp(v) < cmp(cond.lt))) return false;
      if ("gte" in cond && !(cmp(v) >= cmp(cond.gte))) return false;
      if ("gt" in cond && !(cmp(v) > cmp(cond.gt))) return false;
    } else if (v !== cond) {
      return false;
    }
  }
  return true;
}
const cmp = (v) => (v instanceof Date ? v.getTime() : v);

function makeRes() {
  const res = { statusCode: 200, body: null, redirectedTo: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.redirect = (u) => { res.redirectedTo = u; return res; };
  return res;
}

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// ── Paymob HMAC helpers (mirror the handler's exact field mapping/order) ─────
function paymobParamsFromObj(obj) {
  return {
    amount_cents: obj.amount_cents, created_at: obj.created_at, currency: obj.currency,
    error_occured: obj.error_occured, has_parent_transaction: obj.has_parent_transaction,
    id: obj.id, integration_id: obj.integration_id, is_3d_secure: obj.is_3d_secure,
    is_auth: obj.is_auth, is_capture: obj.is_capture, is_refunded: obj.is_refunded,
    is_standalone_payment: obj.is_standalone_payment, is_voided: obj.is_voided,
    order: obj.order?.id ?? obj.order, owner: obj.owner?.id ?? obj.owner, pending: obj.pending,
    "source_data.pan": obj.source_data?.pan, "source_data.sub_type": obj.source_data?.sub_type,
    "source_data.type": obj.source_data?.type, success: obj.success,
  };
}
function signPaymobParams(params, secret = process.env.PAYMOB_HMAC_SECRET) {
  const str = [
    params.amount_cents, params.created_at, params.currency, params.error_occured,
    params.has_parent_transaction, params.id, params.integration_id, params.is_3d_secure,
    params.is_auth, params.is_capture, params.is_refunded, params.is_standalone_payment,
    params.is_voided, params.order, params.owner, params.pending,
    params["source_data.pan"], params["source_data.sub_type"], params["source_data.type"], params.success,
  ].map((v) => String(v ?? "")).join("");
  return crypto.createHmac("sha512", secret).update(str).digest("hex");
}
const signTap = (rawBody, secret = process.env.TAP_WEBHOOK_SECRET) =>
  crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

// ═════════════════════════════════════════════════════════════════════════════
// 1. Signature verification (pure functions)
// ═════════════════════════════════════════════════════════════════════════════

test("Tap: a correct HMAC-SHA256 signature is accepted; tampering is rejected", () => {
  const body = JSON.stringify({ id: "chg_1", status: "CAPTURED" });
  assert.equal(verifyWebhookSignature(body, signTap(body)), true);
  assert.equal(verifyWebhookSignature(body, "deadbeef"), false, "wrong digest rejected");
  assert.equal(verifyWebhookSignature(body, ""), false, "empty digest rejected");
  // a single tampered byte in the body must break the signature
  assert.equal(verifyWebhookSignature(body.replace("CAPTURED", "captured"), signTap(body)), false);
});

test("Paymob: a correct HMAC-SHA512 over the 20 ordered fields is accepted; tampering is rejected", () => {
  const params = {
    amount_cents: 900, created_at: "2026-06-15T10:00:00", currency: "USD", error_occured: false,
    has_parent_transaction: false, id: 123, integration_id: 999, is_3d_secure: true, is_auth: false,
    is_capture: false, is_refunded: false, is_standalone_payment: true, is_voided: false,
    order: 555, owner: 42, pending: false, "source_data.pan": "1234", "source_data.sub_type": "MasterCard",
    "source_data.type": "card", success: true,
  };
  assert.equal(verifyHmac(params, signPaymobParams(params)), true);
  assert.equal(verifyHmac(params, ""), false, "empty hmac rejected");
  assert.equal(verifyHmac({ ...params, success: false }, signPaymobParams(params)), false, "flipping success rejected");
  assert.equal(verifyHmac({ ...params, amount_cents: 1 }, signPaymobParams(params)), false, "changing amount rejected");
});

test("Stripe: constructWebhookEvent accepts a validly-signed payload and rejects a forged one", () => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-11-20.acacia" });
  const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });

  const event = constructWebhookEvent(payload, header);
  assert.equal(event.type, "checkout.session.completed");
  assert.throws(() => constructWebhookEvent(payload, "t=1,v1=forged"), /signature/i);
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. Webhook handlers (req/res + fake prisma)
// ═════════════════════════════════════════════════════════════════════════════

test("Tap webhook: an invalid signature is rejected with 401 before any DB work", async () => {
  installFakePrisma({ subscriptions: [] });
  const req = { headers: { hashdigest: "bad" }, rawBody: JSON.stringify({ id: "chg_1", status: "CAPTURED" }) };
  const res = makeRes();
  await handleTapWebhook(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(calls.subUpsert.length, 0, "no subscription touched on a forged webhook");
});

test("Tap webhook: a CAPTURED charge activates the matching subscription and saves the card", async () => {
  const sub = { id: "s1", organizationId: "o1", gateway: "tap", status: "inactive", tapChargeId: "chg_1", interval: "monthly", amount: 9, plan: { id: "p1", name: "Pro", slug: "pro" } };
  const org = { id: "o1" };
  installFakePrisma({ subscriptions: [sub], org });

  const rawBody = JSON.stringify({ id: "chg_1", status: "CAPTURED", customer: { id: "cust_1" }, card: { id: "card_1" } });
  const req = { headers: { hashdigest: signTap(rawBody) }, rawBody };
  const res = makeRes();
  await handleTapWebhook(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(sub.status, "active", "subscription activated");
  assert.equal(sub.tapCardId, "card_1", "card token saved for future auto-renewals");
  assert.equal(sub.tapCustomerId, "cust_1");
});

test("Tap webhook: an already-active subscription is not re-activated", async () => {
  const sub = { id: "s1", organizationId: "o1", gateway: "tap", status: "active", tapChargeId: "chg_1", interval: "monthly", amount: 9, plan: { id: "p1", name: "Pro" } };
  installFakePrisma({ subscriptions: [sub], org: { id: "o1" } });
  const rawBody = JSON.stringify({ id: "chg_1", status: "CAPTURED" });
  const res = makeRes();
  await handleTapWebhook({ headers: { hashdigest: signTap(rawBody) }, rawBody }, res);
  assert.equal(calls.subUpsert.length, 0, "no upsert when already active");
});

test("Tap webhook: a FAILED charge marks the subscription past_due", async () => {
  const sub = { id: "s1", organizationId: "o1", gateway: "tap", status: "active", tapChargeId: "chg_1" };
  installFakePrisma({ subscriptions: [sub], org: { id: "o1" } });
  const rawBody = JSON.stringify({ id: "chg_1", status: "FAILED" });
  const res = makeRes();
  await handleTapWebhook({ headers: { hashdigest: signTap(rawBody) }, rawBody }, res);
  assert.equal(sub.status, "past_due");
});

test("Paymob webhook: an invalid HMAC is rejected with 401", async () => {
  installFakePrisma({ subscriptions: [] });
  const obj = { id: 1, order: { id: 5, merchant_order_id: "certify_o1_1" }, success: true, pending: false };
  const res = makeRes();
  await handlePaymobWebhook({ body: { type: "TRANSACTION", obj, hmac: "forged" } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(calls.subUpsert.length, 0);
});

test("Paymob webhook: a non-TRANSACTION callback is acknowledged without changes", async () => {
  installFakePrisma({ subscriptions: [] });
  const res = makeRes();
  await handlePaymobWebhook({ body: { type: "TOKEN" } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { received: true });
});

test("Paymob webhook: a successful signed transaction activates the subscription", async () => {
  const sub = { id: "s1", organizationId: "o1", gateway: "paymob", status: "inactive", interval: "monthly", amount: 9, plan: { id: "p1", name: "Pro" } };
  installFakePrisma({ subscriptions: [sub], org: { id: "o1" } });

  const obj = {
    amount_cents: 900, created_at: "2026-06-15T10:00:00", currency: "USD", error_occured: false,
    has_parent_transaction: false, id: 77, integration_id: 999, is_3d_secure: true, is_auth: false,
    is_capture: false, is_refunded: false, is_standalone_payment: true, is_voided: false,
    order: { id: 555, merchant_order_id: "certify_o1_123" }, owner: 42, pending: false,
    source_data: { pan: "1234", sub_type: "MasterCard", type: "card" }, success: true,
  };
  const hmac = signPaymobParams(paymobParamsFromObj(obj));
  const res = makeRes();
  await handlePaymobWebhook({ body: { type: "TRANSACTION", obj, hmac } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(sub.status, "active");
});

test("Paymob webhook: a failed signed transaction marks the subscription past_due", async () => {
  const sub = { id: "s1", organizationId: "o1", gateway: "paymob", status: "active", interval: "monthly", amount: 9, plan: { id: "p1", name: "Pro" } };
  installFakePrisma({ subscriptions: [sub], org: { id: "o1" } });

  const obj = {
    amount_cents: 900, created_at: "2026-06-15T10:00:00", currency: "USD", error_occured: true,
    has_parent_transaction: false, id: 78, integration_id: 999, is_3d_secure: true, is_auth: false,
    is_capture: false, is_refunded: false, is_standalone_payment: true, is_voided: false,
    order: { id: 556, merchant_order_id: "certify_o1_123" }, owner: 42, pending: false,
    source_data: { pan: "1234", sub_type: "MasterCard", type: "card" }, success: false,
  };
  const hmac = signPaymobParams(paymobParamsFromObj(obj));
  const res = makeRes();
  await handlePaymobWebhook({ body: { type: "TRANSACTION", obj, hmac } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(sub.status, "past_due");
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Renewal job: grace-period downgrade logic (pure DB, no network)
// ═════════════════════════════════════════════════════════════════════════════

test("processRenewals: downgrades past_due (beyond grace) and cancel-at-period-end subs to free", async () => {
  const pastDueOld = { id: "s1", organizationId: "o1", gateway: "tap", status: "past_due", currentPeriodEnd: daysAgo(10), cancelAtPeriodEnd: false, plan: { name: "Pro" } };
  const cancelExpired = { id: "s2", organizationId: "o2", gateway: "stripe", status: "active", currentPeriodEnd: daysAgo(1), cancelAtPeriodEnd: true, organization: { id: "o2" } };
  const pastDueInGrace = { id: "s3", organizationId: "o3", gateway: "tap", status: "past_due", currentPeriodEnd: daysAgo(2), cancelAtPeriodEnd: false, plan: { name: "Pro" } };

  installFakePrisma({
    subscriptions: [pastDueOld, cancelExpired, pastDueInGrace],
    plans: [{ id: "free1", slug: "free" }],
  });

  await processRenewals();

  // beyond the 7-day grace window → downgraded to free
  assert.equal(pastDueOld.status, "cancelled");
  assert.equal(pastDueOld.planId, "free1");
  assert.equal(pastDueOld.cancelAtPeriodEnd, false);
  assert.ok(pastDueOld.cancelledAt instanceof Date);

  // explicit cancel-at-period-end whose period has ended → downgraded too
  assert.equal(cancelExpired.status, "cancelled");
  assert.equal(cancelExpired.planId, "free1");

  // both downgraded orgs were moved to the free plan
  const downgradedOrgs = calls.orgUpdate.filter((c) => c.data.planId === "free1").map((c) => c.where.id);
  assert.deepEqual(downgradedOrgs.sort(), ["o1", "o2"]);

  // STILL within the grace window → must NOT be downgraded (regression guard)
  assert.equal(pastDueInGrace.status, "past_due");
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. Webhook idempotency (retry/replay protection)
// ═════════════════════════════════════════════════════════════════════════════

test("Tap webhook: a replayed CAPTURED event is processed only once", async () => {
  const sub = { id: "s1", organizationId: "o1", gateway: "tap", status: "inactive", tapChargeId: "chg_1", interval: "monthly", amount: 9, plan: { id: "p1", name: "Pro" } };
  installFakePrisma({ subscriptions: [sub], org: { id: "o1" } });
  const rawBody = JSON.stringify({ id: "chg_1", status: "CAPTURED" });
  const req = { headers: { hashdigest: signTap(rawBody) }, rawBody };

  await handleTapWebhook(req, makeRes());
  assert.equal(sub.status, "active");
  const firstUpserts = calls.subUpsert.length;

  // replay the identical signed event → must be a no-op (already recorded)
  await handleTapWebhook(req, makeRes());
  assert.equal(calls.subUpsert.length, firstUpserts, "replayed event did not re-apply the plan");
});

test("Paymob webhook: a duplicate transaction id is ignored", async () => {
  const sub = { id: "s1", organizationId: "o1", gateway: "paymob", status: "inactive", interval: "monthly", amount: 9, plan: { id: "p1", name: "Pro" } };
  // pre-seed the event as already processed
  installFakePrisma({ subscriptions: [sub], org: { id: "o1" }, seenEvents: ["paymob:77"] });

  const obj = {
    amount_cents: 900, created_at: "2026-06-15T10:00:00", currency: "USD", error_occured: false,
    has_parent_transaction: false, id: 77, integration_id: 999, is_3d_secure: true, is_auth: false,
    is_capture: false, is_refunded: false, is_standalone_payment: true, is_voided: false,
    order: { id: 555, merchant_order_id: "certify_o1_123" }, owner: 42, pending: false,
    source_data: { pan: "1234", sub_type: "MasterCard", type: "card" }, success: true,
  };
  const hmac = signPaymobParams(paymobParamsFromObj(obj));
  const res = makeRes();
  await handlePaymobWebhook({ body: { type: "TRANSACTION", obj, hmac } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(sub.status, "inactive", "duplicate event must not activate the subscription");
  assert.equal(calls.subUpsert.length, 0);
});
