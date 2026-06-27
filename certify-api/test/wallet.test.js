// Tests for the trainee certificate wallet: no email enumeration on request,
// and token-gated listing (valid/invalid/wrong-type). Prisma is faked in-memory;
// no email/network. The capability token is a signed JWT over the email.

import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { prisma } from "../src/db/prisma.js";
import { config } from "../src/config/index.js";
import { requestWalletLink, getWallet } from "../src/controllers/walletController.js";

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const next = (e) => { if (e) throw e; };
const token = (payload) => jwt.sign(payload, config.appKey, { algorithm: "HS256" });

test("requestWalletLink: generic 200 whether or not certs exist (no enumeration)", async () => {
  prisma.certificate = { count: async () => 0 };
  const res1 = makeRes();
  await requestWalletLink({ body: { email: "nobody@x.com" } }, res1, next);
  assert.equal(res1.statusCode, 200);
  assert.deepEqual(res1.body, { ok: true });

  prisma.certificate = { count: async () => 3 };
  const res2 = makeRes();
  await requestWalletLink({ body: { email: "has@x.com" } }, res2, next);
  assert.equal(res2.statusCode, 200);
  assert.deepEqual(res2.body, { ok: true }, "identical response so existence can't be probed");
});

test("requestWalletLink: rejects an invalid email (422)", async () => {
  const res = makeRes();
  await requestWalletLink({ body: { email: "not-an-email" } }, res, next);
  assert.equal(res.statusCode, 422);
});

test("getWallet: a valid token lists that email's non-revoked certificates", async () => {
  prisma.certificate = {
    findMany: async ({ where }) => {
      assert.equal(where.recipientEmail, "owner@x.com");
      assert.deepEqual(where.status, { not: "revoked" });
      return [
        { recipientName: "Owner", courseName: "Math", verificationCode: "CERT-1", issueDate: new Date(), pdfUrl: "p/a.pdf", organization: { name: "Acme" } },
      ];
    },
  };
  const res = makeRes();
  await getWallet({ params: { token: token({ typ: "wallet", email: "owner@x.com" }) } }, res, next);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.email, "owner@x.com");
  assert.equal(res.body.certificates.length, 1);
  assert.equal(res.body.certificates[0].organization_name, "Acme");
  assert.match(res.body.certificates[0].verify_url, /CERT-1$/);
  assert.match(res.body.certificates[0].pdf_url, /\/storage\/p\/a\.pdf$/);
});

test("getWallet: rejects an invalid/expired token (401)", async () => {
  const res = makeRes();
  await getWallet({ params: { token: "garbage.token.here" } }, res, next);
  assert.equal(res.statusCode, 401);
});

test("getWallet: rejects a well-signed token of the wrong type (401)", async () => {
  const res = makeRes();
  await getWallet({ params: { token: token({ typ: "mfa", email: "owner@x.com" }) } }, res, next);
  assert.equal(res.statusCode, 401);
});
