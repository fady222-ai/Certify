import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/db/prisma.js";
import {
  listMembers, createMember, updateMemberRole, deleteMember,
} from "../src/controllers/memberController.js";

// Controller-level tests with an in-memory Prisma fake (no DB/network), same
// isolation strategy as auth.test.js / tickets.test.js.

let users;
let members;

function installFakePrisma() {
  users = [];
  members = [];

  prisma.user = {
    findUnique: async ({ where }) => users.find((u) => u.email === where.email || u.id === where.id) ?? null,
    create: async ({ data }) => {
      const u = { id: randomUUID(), ...data };
      users.push(u);
      return u;
    },
    delete: async ({ where }) => {
      users = users.filter((u) => u.id !== where.id);
      return {};
    },
  };

  prisma.organizationMember = {
    findMany: async ({ where }) =>
      members
        .filter((m) => m.organizationId === where.organizationId)
        .map((m) => ({ ...m, user: users.find((u) => u.id === m.userId) ?? null })),
    count: async ({ where }) => members.filter((m) => m.organizationId === where.organizationId).length,
    findFirst: async ({ where }) =>
      members.find((m) => m.id === where.id && m.organizationId === where.organizationId) ?? null,
    create: async ({ data }) => {
      const m = { id: randomUUID(), joinedAt: new Date(), ...data };
      members.push(m);
      return { ...m, user: users.find((u) => u.id === m.userId) ?? null };
    },
    update: async ({ where, data }) => {
      const m = members.find((x) => x.id === where.id);
      Object.assign(m, data);
      return { ...m, user: users.find((u) => u.id === m.userId) ?? null };
    },
    delete: async ({ where }) => {
      members = members.filter((m) => m.id !== where.id);
      return {};
    },
  };

  prisma.certificate = {
    groupBy: async () => [], // per-member usage; empty in these tests
  };

  prisma.$transaction = async (arg) =>
    typeof arg === "function" ? arg(prisma) : Promise.all(arg);
}

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

const ORG = { id: "org1", plan: { teamMembersLimit: 2, certificatesPerMonth: 1000 } };
function ownerReq(body = {}) { return { organization: ORG, membershipRole: "owner", body, params: {} }; }
const next = (e) => { if (e) throw e; };

beforeEach(() => {
  installFakePrisma();
  // The owner already occupies one seat.
  members.push({ id: "m-owner", organizationId: "org1", userId: "u-owner", role: "owner" });
  users.push({ id: "u-owner", name: "المالك", email: "owner@x.com" });
});

test("owner can create a member; account is pre-verified", async () => {
  const res = makeRes();
  await createMember(
    { ...ownerReq({ name: "سعد", email: "saad@x.com", password: "password1", role: "member", monthlyLimit: 10 }) },
    res, next,
  );
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.role, "member");
  assert.equal(res.body.monthly_limit, 10);
  const created = users.find((u) => u.email === "saad@x.com");
  assert.equal(created.emailVerified, true);
});

test("enforces the plan team-member limit", async () => {
  // limit=2, owner takes 1 → one more allowed, then full.
  await createMember(ownerReq({ name: "عضو أول", email: "a@x.com", password: "password1", role: "member", monthlyLimit: 10 }), makeRes(), next);
  const res = makeRes();
  await createMember(ownerReq({ name: "عضو ثانٍ", email: "b@x.com", password: "password1", role: "member", monthlyLimit: 10 }), res, next);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /الحد الأقصى/);
});

test("rejects a duplicate email with 409", async () => {
  const res = makeRes();
  await createMember(ownerReq({ name: "مكرر", email: "owner@x.com", password: "password1", role: "member", monthlyLimit: 10 }), res, next);
  assert.equal(res.statusCode, 409);
});

test("rejects creating a member without a monthly limit (422)", async () => {
  const res = makeRes();
  await createMember(ownerReq({ name: "بلا حدّ", email: "n@x.com", password: "password1", role: "member" }), res, next);
  assert.equal(res.statusCode, 422);
});

test("rejects a member limit above the academy quota (422)", async () => {
  const res = makeRes();
  await createMember(ownerReq({ name: "كبير", email: "big@x.com", password: "password1", role: "member", monthlyLimit: 5000 }), res, next);
  assert.equal(res.statusCode, 422);
  assert.match(res.body.message, /حصّة الأكاديمية/);
});

test("a non-manager (member) cannot create members", async () => {
  const res = makeRes();
  await createMember(
    { organization: ORG, membershipRole: "member", body: { name: "x", email: "y@x.com", password: "password1", role: "member" }, params: {} },
    res, next,
  );
  assert.equal(res.statusCode, 403);
});

test("only the owner can change roles; the owner row is protected", async () => {
  members.push({ id: "m1", organizationId: "org1", userId: "u1", role: "member" });
  users.push({ id: "u1", name: "ع", email: "u1@x.com" });

  // admin cannot change roles
  const r1 = makeRes();
  await updateMemberRole({ organization: ORG, membershipRole: "admin", body: { role: "admin" }, params: { id: "m1" } }, r1, next);
  assert.equal(r1.statusCode, 403);

  // owner can promote a member
  const r2 = makeRes();
  await updateMemberRole({ ...ownerReq({ role: "admin" }), params: { id: "m1" } }, r2, next);
  assert.equal(r2.statusCode, 200);
  assert.equal(r2.body.role, "admin");

  // owner row cannot be changed
  const r3 = makeRes();
  await updateMemberRole({ ...ownerReq({ role: "member" }), params: { id: "m-owner" } }, r3, next);
  assert.equal(r3.statusCode, 409);
});

test("cannot delete the owner; can delete a member", async () => {
  members.push({ id: "m1", organizationId: "org1", userId: "u1", role: "member" });
  users.push({ id: "u1", name: "ع", email: "u1@x.com" });

  const r1 = makeRes();
  await deleteMember({ ...ownerReq(), params: { id: "m-owner" } }, r1, next);
  assert.equal(r1.statusCode, 409);

  const r2 = makeRes();
  await deleteMember({ ...ownerReq(), params: { id: "m1" } }, r2, next);
  assert.equal(r2.body.ok, true);
  assert.equal(members.find((m) => m.id === "m1"), undefined);
  assert.equal(users.find((u) => u.id === "u1"), undefined);
});

test("listMembers reports manage permission and limit", async () => {
  const res = makeRes();
  await listMembers(ownerReq(), res, next);
  assert.equal(res.body.can_manage, true);
  assert.equal(res.body.limit, 2);
  assert.equal(res.body.data.length, 1);
});
