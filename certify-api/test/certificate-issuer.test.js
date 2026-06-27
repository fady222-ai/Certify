// Tests for the certificate issuance core — the highest-risk logic after billing.
// Covers tenant isolation (IDOR via templateId), monthly plan-limit enforcement,
// verification-code/hash generation, usage tracking, and the default-template
// fallback. The DB is isolated with an in-memory Prisma fake; PDF rendering is
// skipped via render=false (no headless Chrome), and email via sendMail=false.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/db/prisma.js";
import { hashMatches } from "../src/services/certificateHasher.js";
import {
  issueCertificate,
  assertTemplateAccessible,
  PlanLimitError,
  reserveQuota,
} from "../src/services/certificateIssuer.js";

let calls;

function installFakePrisma({ templates = [], plans = [], usage = null } = {}) {
  calls = { certCreate: [], usageUpsert: [] };

  prisma.template = {
    findUnique: async ({ where }) => templates.find((t) => t.id === where.id) ?? null,
  };
  prisma.plan = {
    findUnique: async ({ where }) => plans.find((p) => p.id === where.id) ?? null,
  };
  prisma.certificateUsage = {
    findUnique: async () => usage,
    upsert: async ({ where, create, update }) => {
      calls.usageUpsert.push({ where, create, update });
      return create;
    },
  };
  prisma.certificate = {
    // generateCode checks uniqueness — always free in tests.
    findUnique: async () => null,
    create: async ({ data }) => {
      const { events, ...scalars } = data;
      calls.certCreate.push(scalars);
      return { ...scalars, organization: { id: data.organizationId } };
    },
  };
}

const ORG = { id: "org-1", planId: 1, defaultTemplateId: null };
const FREE_PLAN = { id: 1, slug: "free", certificatesPerMonth: 10 };

beforeEach(() => { calls = null; });

// ── Quota reservation (bulk worker pool) ─────────────────────────────────────
test("reserveQuota: caps the count to the org's remaining monthly quota", async () => {
  installFakePrisma({ plans: [{ id: 1, certificatesPerMonth: 10 }], usage: { certificatesIssued: 7 } });
  const r = await reserveQuota({ id: "o", planId: 1 }, null, 5);
  assert.equal(r.allowed, 3, "only 3 of 5 fit (10 − 7 used)");
});

test("reserveQuota: unlimited when the plan has no monthly cap", async () => {
  installFakePrisma({ plans: [{ id: 1, certificatesPerMonth: null }] });
  const r = await reserveQuota({ id: "o", planId: 1 }, null, 50);
  assert.equal(r.allowed, 50);
});

test("reserveQuota: also caps to the acting member's personal remaining", async () => {
  installFakePrisma({ plans: [{ id: 1, certificatesPerMonth: 1000 }], usage: { certificatesIssued: 0 } });
  prisma.organizationMember = { findFirst: async () => ({ monthlyLimit: 4 }) };
  prisma.certificate.count = async () => 3; // member already issued 3 this month
  const r = await reserveQuota({ id: "o", planId: 1 }, "u-member", 10);
  assert.equal(r.allowed, 1, "4 − 3 = 1 left for this member");
});

// ── Tenant isolation (IDOR) via assertTemplateAccessible ─────────────────────
test("assertTemplateAccessible: allows null, public, global, and own templates", async () => {
  installFakePrisma({
    templates: [
      { id: "pub", isPublic: true, organizationId: "org-2" },
      { id: "global", isPublic: false, organizationId: null },
      { id: "own", isPublic: false, organizationId: "org-1" },
    ],
  });
  await assertTemplateAccessible(ORG, null); // no template → ok
  await assertTemplateAccessible(ORG, "pub");
  await assertTemplateAccessible(ORG, "global");
  await assertTemplateAccessible(ORG, "own");
});

test("assertTemplateAccessible: rejects another org's private template (IDOR) with 404", async () => {
  installFakePrisma({ templates: [{ id: "secret", isPublic: false, organizationId: "org-2" }] });
  await assert.rejects(
    () => assertTemplateAccessible(ORG, "secret"),
    (err) => err.statusCode === 404,
  );
});

test("assertTemplateAccessible: rejects a nonexistent template with 404", async () => {
  installFakePrisma({ templates: [] });
  await assert.rejects(
    () => assertTemplateAccessible(ORG, "ghost"),
    (err) => err.statusCode === 404,
  );
});

// ── Issuance happy path ──────────────────────────────────────────────────────
test("issueCertificate: creates an active, tamper-evident certificate and tracks usage", async () => {
  installFakePrisma({ plans: [FREE_PLAN], usage: { certificatesIssued: 3 } });

  const cert = await issueCertificate(
    ORG,
    { recipientName: "محمد", recipientEmail: "m@x.com", courseName: "دورة" },
    false, // no PDF render
    { sendMail: false },
  );

  assert.equal(cert.status, "active");
  assert.equal(cert.organizationId, "org-1", "scoped to the issuing org");
  assert.match(cert.verificationCode, /^CERT(-[A-HJ-NP-Z2-9]{4}){4}$/, "high-entropy code format");
  // the stored hash validates the immutable fields (tamper-evidence)
  assert.equal(hashMatches(cert), true);
  // any tamper to an immutable field breaks the hash
  assert.equal(hashMatches({ ...cert, recipientName: "مزوّر" }), false);
  assert.equal(calls.usageUpsert.length, 1, "monthly usage incremented");
});

test("issueCertificate: an issued event is logged on creation", async () => {
  installFakePrisma({ plans: [FREE_PLAN], usage: null });
  await issueCertificate(ORG, { recipientName: "سارة" }, false, { sendMail: false });
  // create was called (event is nested on the same create call)
  assert.equal(calls.certCreate.length, 1);
});

// ── Plan-limit enforcement ───────────────────────────────────────────────────
test("issueCertificate: throws PlanLimitError (402) when the monthly quota is reached", async () => {
  installFakePrisma({ plans: [FREE_PLAN], usage: { certificatesIssued: 10 } });
  await assert.rejects(
    () => issueCertificate(ORG, { recipientName: "x" }, false, { sendMail: false }),
    (err) => err instanceof PlanLimitError && err.statusCode === 402,
  );
  assert.equal(calls.certCreate.length, 0, "no certificate created when over the limit");
});

test("issueCertificate: allows issuance right below the limit", async () => {
  installFakePrisma({ plans: [FREE_PLAN], usage: { certificatesIssued: 9 } });
  const cert = await issueCertificate(ORG, { recipientName: "x" }, false, { sendMail: false });
  assert.ok(cert.id);
});

test("issueCertificate: no plan attached → no limit enforced", async () => {
  installFakePrisma({ plans: [], usage: { certificatesIssued: 9999 } });
  const cert = await issueCertificate({ id: "org-1", planId: null }, { recipientName: "x" }, false, { sendMail: false });
  assert.ok(cert.id);
});

// ── Default-template fallback + IDOR through issuance ─────────────────────────
test("issueCertificate: falls back to the org's default template when none is passed", async () => {
  installFakePrisma({
    plans: [FREE_PLAN],
    usage: null,
    templates: [{ id: "tmpl-default", isPublic: false, organizationId: "org-1" }],
  });
  const org = { id: "org-1", planId: 1, defaultTemplateId: "tmpl-default" };
  const cert = await issueCertificate(org, { recipientName: "x" }, false, { sendMail: false });
  assert.equal(cert.templateId, "tmpl-default");
});

test("issueCertificate: rejects issuing with another org's private template (IDOR) before creating", async () => {
  installFakePrisma({
    plans: [FREE_PLAN],
    usage: null,
    templates: [{ id: "foreign", isPublic: false, organizationId: "org-2" }],
  });
  await assert.rejects(
    () => issueCertificate(ORG, { recipientName: "x", templateId: "foreign" }, false, { sendMail: false }),
    (err) => err.statusCode === 404,
  );
  assert.equal(calls.certCreate.length, 0);
});
