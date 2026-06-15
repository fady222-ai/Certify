import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db/prisma.js";
import { verifyToken, login, verifyEmail } from "../src/services/authService.js";

// These are integration tests for the auth flow. The Prisma singleton is a
// plain object, so we isolate the DB by swapping its model methods with an
// in-memory fake — no real database, no experimental module-mock flags.
//
// They lock in the brute-force defences we rely on:
//   • OTP: per-code attempt counter (invalidate after MAX_OTP_ATTEMPTS) + expiry.
//   • login: uniform 401 (no user enumeration), failed-attempt counter is
//     monitoring-only (no per-account lockout — that was a DoS vector).

// ── In-memory Prisma fake ────────────────────────────────────────────────────
let calls;

function installFakePrisma({ user = {}, org = null, vToken = null } = {}) {
  calls = { userUpdate: [], vTokenUpdate: [], vTokenCreate: [], otpDeleted: false };

  prisma.user = {
    findUnique: async ({ where }) => {
      if (!user) return null;
      if (where.email !== undefined) return user.email === where.email ? user : null;
      if (where.id !== undefined) return user.id === where.id ? user : null;
      return null;
    },
    update: async ({ where, data }) => {
      calls.userUpdate.push({ where, data });
      Object.assign(user, normalize(data));
      return user;
    },
  };

  prisma.organization = {
    findFirst: async ({ where }) => {
      // login identifier lookup by academy name → owner
      if (where?.name) return org && matchName(org, where.name) ? { ownerId: org.ownerId } : null;
      // primaryOrg lookup by ownerId
      if (where?.ownerId !== undefined) return org && org.ownerId === where.ownerId ? org : null;
      return org;
    },
  };

  prisma.verificationToken = {
    findFirst: async () => vToken,
    update: async ({ where, data }) => {
      calls.vTokenUpdate.push({ where, data });
      if (vToken) Object.assign(vToken, normalize(data));
      return vToken;
    },
    deleteMany: async () => { calls.otpDeleted = true; return { count: 0 }; },
    create: async ({ data }) => { calls.vTokenCreate.push(data); return data; },
  };

  prisma.$transaction = async (ops) => Promise.all(ops);
}

// Translate Prisma's `{ increment: 1 }` style updates into plain values.
function normalize(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v === "object" && "increment" in v ? undefined : v;
    if (v && typeof v === "object" && "increment" in v) {
      out[k] = "__increment__";
      out[`__inc_${k}`] = v.increment;
    }
  }
  return out;
}

function matchName(org, where) {
  const target = typeof where === "object" ? where.equals : where;
  return String(org.name).toLowerCase() === String(target).toLowerCase();
}

async function expectStatus(promise, status) {
  try {
    await promise;
    assert.fail(`expected error with status ${status}, but it resolved`);
  } catch (err) {
    assert.equal(err.statusCode, status, `expected ${status}, got ${err.statusCode}: ${err.message}`);
    return err;
  }
}

beforeEach(() => { calls = null; });

// ── OTP verification ─────────────────────────────────────────────────────────
test("verifyEmail: correct code marks the user verified and returns a JWT", async () => {
  installFakePrisma({
    user: { id: "u1", email: "a@x.com", name: "أحمد", emailVerified: false, role: "user" },
    org: null,
    vToken: { id: "v1", userId: "u1", code: "123456", attempts: 0, usedAt: null, expiresAt: new Date(Date.now() + 60000) },
  });

  const { token } = await verifyEmail({ userId: "u1", code: "123456" });

  assert.ok(token, "a token is issued");
  assert.equal(verifyToken(token).sub, "u1");
  // the user is flipped to verified and the code is consumed
  assert.ok(calls.userUpdate.some((u) => u.data.emailVerified === true));
  assert.ok(calls.vTokenUpdate.some((u) => u.data.usedAt instanceof Date));
});

test("verifyEmail: a wrong code increments attempts and throws 422", async () => {
  installFakePrisma({
    user: { id: "u1", email: "a@x.com" },
    vToken: { id: "v1", userId: "u1", code: "123456", attempts: 1, usedAt: null, expiresAt: new Date(Date.now() + 60000) },
  });

  await expectStatus(verifyEmail({ userId: "u1", code: "000000" }), 422);
  // it bumped the per-code attempt counter rather than consuming the code
  const inc = calls.vTokenUpdate.find((u) => u.data.attempts?.increment === 1);
  assert.ok(inc, "attempts incremented by 1");
  assert.ok(!calls.vTokenUpdate.some((u) => u.data.usedAt), "code not yet invalidated");
});

test("verifyEmail: too many wrong guesses invalidates the code and throws 429", async () => {
  installFakePrisma({
    user: { id: "u1", email: "a@x.com" },
    // attempts already at the cap (5) — even a correct code must be rejected
    vToken: { id: "v1", userId: "u1", code: "123456", attempts: 5, usedAt: null, expiresAt: new Date(Date.now() + 60000) },
  });

  await expectStatus(verifyEmail({ userId: "u1", code: "123456" }), 429);
  assert.ok(calls.vTokenUpdate.some((u) => u.data.usedAt instanceof Date), "code is invalidated (usedAt set)");
});

test("verifyEmail: an expired code throws 422", async () => {
  installFakePrisma({
    user: { id: "u1", email: "a@x.com" },
    vToken: { id: "v1", userId: "u1", code: "123456", attempts: 0, usedAt: null, expiresAt: new Date(Date.now() - 1000) },
  });
  await expectStatus(verifyEmail({ userId: "u1", code: "123456" }), 422);
});

test("verifyEmail: no outstanding code throws 422", async () => {
  installFakePrisma({ user: { id: "u1" }, vToken: null });
  await expectStatus(verifyEmail({ userId: "u1", code: "123456" }), 422);
});

// ── Login ────────────────────────────────────────────────────────────────────
test("login: correct password resets the failed-attempt counter and returns a JWT", async () => {
  const passwordHash = await bcrypt.hash("correct-horse", 10);
  installFakePrisma({
    user: { id: "u1", email: "a@x.com", passwordHash, emailVerified: true, failedLoginAttempts: 3, role: "user" },
    org: { id: "o1", ownerId: "u1", name: "أكاديميتي", plan: null },
  });

  const { token } = await login({ identifier: "a@x.com", password: "correct-horse" });

  assert.ok(token);
  assert.equal(verifyToken(token).sub, "u1");
  assert.ok(calls.userUpdate.some((u) => u.data.failedLoginAttempts === 0), "counter reset on success");
});

test("login: wrong password throws 401 and increments failedLoginAttempts (monitoring only)", async () => {
  const passwordHash = await bcrypt.hash("correct-horse", 10);
  installFakePrisma({
    user: { id: "u1", email: "a@x.com", passwordHash, emailVerified: true, failedLoginAttempts: 0 },
  });

  const err = await expectStatus(login({ identifier: "a@x.com", password: "wrong" }), 401);
  // counter goes up, but there is no per-account lock (no lockedUntil written)
  assert.ok(calls.userUpdate.some((u) => u.data.failedLoginAttempts === 1));
  assert.ok(!calls.userUpdate.some((u) => "lockedUntil" in u.data), "no account lockout is applied");
  // generic message — must not reveal whether the account exists
  assert.match(err.message, /غير صحيحة/);
});

test("login: unknown identifier throws the same 401 (no user enumeration)", async () => {
  installFakePrisma({ user: null, org: null });
  const err = await expectStatus(login({ identifier: "ghost@x.com", password: "whatever" }), 401);
  assert.match(err.message, /غير صحيحة/);
});

test("login: a verified account can sign in by academy name (resolves to its owner)", async () => {
  const passwordHash = await bcrypt.hash("correct-horse", 10);
  installFakePrisma({
    user: { id: "u1", email: "owner@x.com", passwordHash, emailVerified: true, failedLoginAttempts: 0, role: "user" },
    org: { id: "o1", ownerId: "u1", name: "أكاديمية النور", plan: null },
  });

  // identifier is the academy name, not the email
  const { token } = await login({ identifier: "أكاديمية النور", password: "correct-horse" });
  assert.equal(verifyToken(token).sub, "u1");
});

test("login: correct password but unverified email throws 403 and (re)sends an OTP", async () => {
  const passwordHash = await bcrypt.hash("correct-horse", 10);
  installFakePrisma({
    user: { id: "u1", email: "a@x.com", name: "أحمد", passwordHash, emailVerified: false, failedLoginAttempts: 0 },
  });

  const err = await expectStatus(login({ identifier: "a@x.com", password: "correct-horse" }), 403);
  assert.equal(err.userId, "u1", "exposes the userId so the client can prompt for the OTP");
  assert.ok(calls.otpDeleted, "old codes cleared");
  assert.equal(calls.vTokenCreate.length, 1, "a fresh OTP is issued");
});
