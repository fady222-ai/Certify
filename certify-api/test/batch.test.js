// Tests for bulk (batch) certificate issuance: file parsing/normalisation,
// per-row issuance aggregation, and the createBatch request guards. The DB is
// isolated with an in-memory Prisma fake; the per-row issuer is injected so no
// headless Chrome is launched (issueCertificate itself is covered separately).

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { prisma } from "../src/db/prisma.js";
import {
  parseFile,
  processBatchAsync,
  isValidEmail,
  createBatch,
  downloadTemplate,
} from "../src/controllers/batchController.js";

const csvFile = (text) => ({ originalname: "rows.csv", mimetype: "text/csv", buffer: Buffer.from(text) });

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

let calls;
function installFakePrisma() {
  calls = { batchCreate: [], batchUpdate: [] };
  prisma.batch = {
    create: async ({ data }) => { calls.batchCreate.push(data); return { ...data }; },
    update: async ({ where, data }) => { calls.batchUpdate.push({ where, data }); return data; },
  };
}
beforeEach(() => { calls = null; });

// ── File parsing / normalisation ─────────────────────────────────────────────
test("parseFile (CSV): maps standard columns and drops invalid emails", async () => {
  const rows = await parseFile(csvFile(
    "name,email,course_name\n" +
    "Ahmed,ahmed@x.com,Math\n" +
    "Sara,not-an-email,Physics\n",
  ));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { recipientName: "Ahmed", recipientEmail: "ahmed@x.com", recipientPhone: undefined, courseName: "Math" });
  assert.equal(rows[1].recipientName, "Sara");
  assert.equal(rows[1].recipientEmail, undefined, "invalid email dropped but row kept");
});

test("parseFile (CSV): supports recipient_name and Arabic headers", async () => {
  const aliased = await parseFile(csvFile("recipient_name,course\nLayla,Chemistry\n"));
  assert.deepEqual(aliased[0], { recipientName: "Layla", recipientEmail: undefined, recipientPhone: undefined, courseName: "Chemistry" });

  const arabic = await parseFile(csvFile("الاسم,البريد,الدورة\nمحمد,m@x.com,الرياضيات\n"));
  assert.deepEqual(arabic[0], { recipientName: "محمد", recipientEmail: "m@x.com", recipientPhone: undefined, courseName: "الرياضيات" });
});

test("parseFile (CSV): skips rows with no name", async () => {
  const rows = await parseFile(csvFile("name,email\n,orphan@x.com\nReal,r@x.com\n"));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recipientName, "Real");
});

test("parseFile (CSV): parses a phone column for WhatsApp delivery (aliases)", async () => {
  const rows = await parseFile(csvFile("name,phone\nAhmed,+966 50 123 4567\n"));
  assert.equal(rows[0].recipientPhone, "+966 50 123 4567");

  const wa = await parseFile(csvFile("name,whatsapp\nSara,201001234567\n"));
  assert.equal(wa[0].recipientPhone, "201001234567");

  const ar = await parseFile(csvFile("الاسم,الجوال\nمحمد,0500000000\n"));
  assert.equal(ar[0].recipientPhone, "0500000000");

  const none = await parseFile(csvFile("name\nNoPhone\n"));
  assert.equal(none[0].recipientPhone, undefined);
});

test("parseFile (CSV): strips the UTF-8 BOM Excel adds so the first header still maps", async () => {
  const rows = await parseFile(csvFile("﻿name,email\nAhmed,a@x.com\n"));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recipientName, "Ahmed", "BOM-prefixed header must still resolve to name");
});

test("parseFile (XLSX): reads the first sheet", async () => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("s1");
  sheet.addRow(["name", "email", "course_name"]);
  sheet.addRow(["Omar", "omar@x.com", "History"]);
  const buffer = await wb.xlsx.writeBuffer();

  const rows = await parseFile({ originalname: "data.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { recipientName: "Omar", recipientEmail: "omar@x.com", recipientPhone: undefined, courseName: "History" });
});

test("downloadTemplate: emits a valid .xlsx whose headers round-trip through parseFile", async () => {
  let sent = null;
  const headers = {};
  const res = { setHeader: (k, v) => { headers[k] = v; }, send: (b) => { sent = b; }, status: () => ({ json: () => {} }) };
  await downloadTemplate({}, res);

  assert.match(headers["Content-Type"], /spreadsheetml\.sheet/);
  assert.match(headers["Content-Disposition"], /certify-bulk-template\.xlsx/);
  assert.equal(sent.slice(0, 2).toString(), "PK", "is a real xlsx (zip) file");

  // The template the academy downloads must parse back with our exact columns.
  const rows = await parseFile({
    originalname: "certify-bulk-template.xlsx",
    mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: sent,
  });
  assert.equal(rows.length, 1, "the one example row is parsed");
  assert.equal(rows[0].recipientName, "Abdullah Mohammed");
  assert.equal(rows[0].recipientEmail, "student@example.com");
  assert.equal(rows[0].courseName, "Digital Marketing Fundamentals");
  assert.ok(rows[0].recipientPhone, "phone column is recognized");
});

test("isValidEmail accepts well-formed and rejects malformed addresses", () => {
  assert.equal(isValidEmail("a@b.co"), true);
  assert.equal(isValidEmail("no-at"), false);
  assert.equal(isValidEmail("a@b"), false);
  assert.equal(isValidEmail("a b@c.com"), false);
});

// ── Per-row issuance aggregation ─────────────────────────────────────────────
test("processBatchAsync: counts successes and completes the batch", async () => {
  installFakePrisma();
  const issued = [];
  const fakeIssue = async (org, data) => { issued.push(data); return { id: "c" + issued.length }; };

  const rows = [
    { recipientName: "A", recipientEmail: "a@x.com" },
    { recipientName: "B" },
  ];
  await processBatchAsync("batch-1", rows, { id: "org-1" }, "Default Course", "tmpl-1", fakeIssue);

  const update = calls.batchUpdate[0].data;
  assert.equal(update.successCount, 2);
  assert.equal(update.failedCount, 0);
  assert.equal(update.status, "completed");
  assert.ok(update.completedAt instanceof Date);
  // row inherits the batch's default course + template + batchId
  assert.equal(issued[1].courseName, "Default Course");
  assert.equal(issued[0].templateId, "tmpl-1");
  assert.equal(issued[0].batchId, "batch-1");
});

test("processBatchAsync: a per-row failure is counted but doesn't abort the batch", async () => {
  installFakePrisma();
  const fakeIssue = async (org, data) => {
    if (data.recipientName === "BadRow") throw new Error("plan limit or render failure");
    return { id: "ok" };
  };
  const rows = [{ recipientName: "Good" }, { recipientName: "BadRow" }, { recipientName: "AlsoGood" }];
  await processBatchAsync("batch-2", rows, { id: "org-1" }, null, null, fakeIssue);

  const update = calls.batchUpdate[0].data;
  assert.equal(update.successCount, 2);
  assert.equal(update.failedCount, 1);
  assert.equal(update.status, "completed", "partial failure still completes");
});

test("processBatchAsync: forwards recipientPhone to the issuer (WhatsApp path)", async () => {
  installFakePrisma();
  const issued = [];
  const fakeIssue = async (org, data) => { issued.push(data); return { id: "c" }; };
  await processBatchAsync("b-ph", [{ recipientName: "A", recipientPhone: "966500000000" }], { id: "o" }, null, null, fakeIssue);
  assert.equal(issued[0].recipientPhone, "966500000000");
});

test("processBatchAsync: flushes incremental progress during a long batch", async () => {
  installFakePrisma();
  const fakeIssue = async () => ({ id: "ok" });
  const rows = Array.from({ length: 25 }, (_, i) => ({ recipientName: `U${i}` }));
  await processBatchAsync("b-prog", rows, { id: "o" }, null, null, fakeIssue);

  // 25 rows → flushes at 10 and 20 (no status yet) plus a final terminal flush.
  assert.ok(calls.batchUpdate.length >= 3, "progress should be published more than once");
  const intermediate = calls.batchUpdate[0].data;
  assert.equal(intermediate.successCount, 10);
  assert.equal(intermediate.status, undefined, "intermediate flush carries no terminal status");
  const final = calls.batchUpdate[calls.batchUpdate.length - 1].data;
  assert.equal(final.successCount, 25);
  assert.equal(final.status, "completed");
  assert.ok(final.completedAt instanceof Date);
});

test("processBatchAsync: reserves quota and marks overflow rows failed (no overshoot)", async () => {
  installFakePrisma();
  const issued = [];
  const fakeIssue = async (org, data) => { issued.push(data); return { id: "c" }; };
  const rows = Array.from({ length: 5 }, (_, i) => ({ recipientName: `U${i}` }));
  // Only 2 of 5 fit the remaining quota.
  await processBatchAsync("b-ov", rows, { id: "o" }, null, null, fakeIssue, null, {
    reserve: async () => ({ allowed: 2 }),
    ensureUsage: async () => {},
  });
  assert.equal(issued.length, 2, "never issues more than the reserved count");
  const final = calls.batchUpdate[calls.batchUpdate.length - 1].data;
  assert.equal(final.successCount, 2);
  assert.equal(final.failedCount, 3, "the 3 overflow rows are counted failed");
  assert.equal(final.status, "completed");
});

test("processBatchAsync: serializes concurrent batches for the SAME org (no quota race)", async () => {
  installFakePrisma();
  let active = 0;
  let maxActive = 0;
  const reserve = async () => {
    active++; maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, 5)); // hold the critical section briefly
    active--;
    return { allowed: 1 };
  };
  const fakeIssue = async () => ({ id: "c" });
  const deps = { reserve, ensureUsage: async () => {} };
  const org = { id: "same-org" };
  // Fire two batches for the same org at once; the per-org lock must serialize them.
  await Promise.all([
    processBatchAsync("b-a", [{ recipientName: "A" }], org, null, null, fakeIssue, null, deps),
    processBatchAsync("b-b", [{ recipientName: "B" }], org, null, null, fakeIssue, null, deps),
  ]);
  assert.equal(maxActive, 1, "reservations for one org never overlap");
});

test("processBatchAsync: issues with skipLimits (quota already reserved)", async () => {
  installFakePrisma();
  let opts;
  const fakeIssue = async (o, d, r, options) => { opts = options; return { id: "c" }; };
  await processBatchAsync("b-sl", [{ recipientName: "A" }], { id: "o" }, null, null, fakeIssue, "u1", {
    reserve: async () => ({ allowed: 1 }),
    ensureUsage: async () => {},
  });
  assert.equal(opts.skipLimits, true);
  assert.equal(opts.actingUserId, "u1");
});

test("processBatchAsync: marks the batch failed when every row fails", async () => {
  installFakePrisma();
  const fakeIssue = async () => { throw new Error("all fail"); };
  await processBatchAsync("batch-3", [{ recipientName: "X" }, { recipientName: "Y" }], { id: "org-1" }, null, null, fakeIssue);
  assert.equal(calls.batchUpdate[0].data.status, "failed");
  assert.equal(calls.batchUpdate[0].data.failedCount, 2);
});

// ── createBatch entitlement gate ─────────────────────────────────────────────
// Bulk issuance is a paid feature; the org's plan must carry hasBulkIssuance.
const bulkOrg = { id: "o1", plan: { hasBulkIssuance: true } };

test("createBatch: blocks a plan without bulk entitlement (403) before any file work", async () => {
  installFakePrisma();
  const res = makeRes();
  // free plan → hasBulkIssuance falsy
  await createBatch({ file: csvFile("name\nAhmed\n"), body: {}, organization: { id: "o1", plan: { hasBulkIssuance: false } }, user: { id: "u1" } }, res);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /الباقات المدفوعة/);
  assert.equal(calls.batchCreate.length, 0, "no batch created for an unentitled plan");
});

test("createBatch: blocks when the org has no plan at all (403)", async () => {
  installFakePrisma();
  const res = makeRes();
  await createBatch({ file: csvFile("name\nAhmed\n"), body: {}, organization: { id: "o1" }, user: { id: "u1" } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(calls.batchCreate.length, 0);
});

// ── createBatch request guards (entitled plan reaches file validation) ────────
test("createBatch: rejects a request with no file (400)", async () => {
  installFakePrisma();
  const res = makeRes();
  await createBatch({ body: {}, organization: bulkOrg, user: { id: "u1" } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(calls.batchCreate.length, 0);
});

test("createBatch: rejects an empty file (400)", async () => {
  installFakePrisma();
  const res = makeRes();
  await createBatch({ file: csvFile("name,email\n"), body: {}, organization: bulkOrg, user: { id: "u1" } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /فارغ/);
  assert.equal(calls.batchCreate.length, 0);
});

test("createBatch: rejects more than 500 rows (400) before creating a batch", async () => {
  installFakePrisma();
  const header = "name,email\n";
  const body = Array.from({ length: 501 }, (_, i) => `User${i},u${i}@x.com`).join("\n");
  const res = makeRes();
  await createBatch({ file: csvFile(header + body), body: {}, organization: bulkOrg, user: { id: "u1" } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /500/);
  assert.equal(calls.batchCreate.length, 0, "no batch created when over the limit");
});
