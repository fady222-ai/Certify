import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/db/prisma.js";
import { assertWithinMemberLimit, MemberLimitError } from "../src/services/certificateIssuer.js";

// Per-member monthly issuance cap (on top of the org plan limit). In-memory
// Prisma fake — no DB. Owner / uncapped members and API issuance are exempt.
let member; // the OrganizationMember row returned by findFirst
let usedCount; // certificates this member issued this month

beforeEach(() => {
  member = null;
  usedCount = 0;
  prisma.organizationMember = { findFirst: async () => member };
  prisma.certificate = { count: async () => usedCount };
});

const ORG = { id: "org1" };

test("no acting user (API issuance) → no cap", async () => {
  await assertWithinMemberLimit(ORG, null); // resolves
});

test("member without a cap (owner / null) → no cap", async () => {
  member = { monthlyLimit: null };
  await assertWithinMemberLimit(ORG, "u1"); // resolves
});

test("under the cap → allowed", async () => {
  member = { monthlyLimit: 5 };
  usedCount = 4;
  await assertWithinMemberLimit(ORG, "u1"); // resolves
});

test("at the cap → MemberLimitError (402)", async () => {
  member = { monthlyLimit: 5 };
  usedCount = 5;
  await assert.rejects(
    assertWithinMemberLimit(ORG, "u1"),
    (e) => e instanceof MemberLimitError && e.statusCode === 402,
  );
});
