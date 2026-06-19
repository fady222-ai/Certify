import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/db/prisma.js";
import { config } from "../src/config/index.js";
import {
  createTicket,
  listMyTickets,
  getMyTicket,
  replyTicket,
  closeTicket,
  createGuestTicket,
  getGuestTicket,
  replyGuestTicket,
  adminListTickets,
  adminReplyTicket,
  adminSetStatus,
} from "../src/controllers/supportController.js";

// Controller-level tests with an in-memory Prisma fake (no DB, no network),
// same isolation strategy as auth.test.js. Email is disabled so the
// fire-and-forget mailer stays silent and side-effect-free.
config.email.enabled = false;

// ── In-memory Prisma fake ────────────────────────────────────────────────────
let tickets;
let messages;

function matchWhere(t, where) {
  for (const [k, v] of Object.entries(where)) {
    if (k === "user") continue; // relation filters not exercised by these tests
    if (v && typeof v === "object" && Array.isArray(v.in)) {
      if (!v.in.includes(t[k])) return false;
    } else if (t[k] !== v) {
      return false;
    }
  }
  return true;
}

function installFakePrisma() {
  tickets = [];
  messages = [];

  prisma.supportTicket = {
    create: async ({ data }) => {
      const t = {
        id: randomUUID(),
        userId: data.userId ?? null,
        organizationId: data.organizationId ?? null,
        guestName: data.guestName ?? null,
        guestEmail: data.guestEmail ?? null,
        publicToken: data.publicToken ?? randomUUID(),
        subject: data.subject,
        status: data.status ?? "open",
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };
      tickets.push(t);
      if (data.messages?.create) {
        const m = Array.isArray(data.messages.create) ? data.messages.create : [data.messages.create];
        for (const msg of m) {
          messages.push({ id: randomUUID(), ticketId: t.id, authorId: msg.authorId ?? null, ...msg, createdAt: new Date() });
        }
      }
      return { ...t };
    },
    findFirst: async ({ where }) => {
      const t = tickets.find((x) => matchWhere(x, where));
      return t ? { ...t } : null;
    },
    findUnique: async ({ where }) => {
      const t = tickets.find((x) =>
        (where.id !== undefined && x.id === where.id) ||
        (where.publicToken !== undefined && x.publicToken === where.publicToken));
      return t ? { ...t } : null;
    },
    findMany: async ({ where = {} }) => {
      return tickets.filter((x) => matchWhere(x, where)).map((t) => ({ ...t }));
    },
    count: async ({ where = {} }) => tickets.filter((x) => matchWhere(x, where)).length,
    update: async ({ where, data }) => {
      const t = tickets.find((x) => x.id === where.id);
      Object.assign(t, data);
      return { ...t };
    },
  };

  prisma.supportMessage = {
    create: async ({ data }) => {
      const m = { id: randomUUID(), createdAt: new Date(), authorId: data.authorId ?? null, ...data };
      messages.push(m);
      return { ...m };
    },
    findMany: async ({ where }) =>
      messages.filter((m) => m.ticketId === where.ticketId).map((m) => ({ ...m })),
    count: async ({ where }) => messages.filter((m) => m.ticketId === where.ticketId).length,
  };
}

// ── Fake req/res ─────────────────────────────────────────────────────────────
function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}
const rethrow = (e) => { throw e; };

const userA = { id: "user-a", name: "أحمد", email: "a@x.com" };
const userB = { id: "user-b", name: "سارة", email: "b@x.com" };
const admin = { id: "admin-1", name: "الدعم", email: "admin@x.com", role: "admin" };

beforeEach(() => installFakePrisma());

// ── Authenticated user ───────────────────────────────────────────────────────

test("createTicket: persists ticket with userId, status open, first message authorRole user", async () => {
  const res = makeRes();
  await createTicket({ user: userA, organization: { id: "org-1" }, body: { subject: "مشكلة", body: "لا أستطيع الإصدار" } }, res, rethrow);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.status, "open");
  assert.equal(res.body.requester.kind, "user");
  assert.equal(tickets[0].userId, "user-a");
  assert.equal(tickets[0].organizationId, "org-1");
  assert.equal(messages[0].authorRole, "user");
});

test("createTicket: user with no organization is accepted (organizationId null)", async () => {
  const res = makeRes();
  await createTicket({ user: userA, organization: null, body: { subject: "سؤال", body: "استفسار عام" } }, res, rethrow);
  assert.equal(res.statusCode, 201);
  assert.equal(tickets[0].organizationId, null);
});

test("createTicket: invalid (short subject) → 422", async () => {
  const res = makeRes();
  await createTicket({ user: userA, organization: null, body: { subject: "x", body: "y" } }, res, rethrow);
  assert.equal(res.statusCode, 422);
  assert.ok(res.body.errors);
});

test("listMyTickets: returns only my tickets", async () => {
  await createTicket({ user: userA, organization: null, body: { subject: "ticket A", body: "body a" } }, makeRes(), rethrow);
  await createTicket({ user: userB, organization: null, body: { subject: "ticket B", body: "body b" } }, makeRes(), rethrow);

  const res = makeRes();
  await listMyTickets({ user: userA, query: {} }, res, rethrow);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.data[0].subject, "ticket A");
});

test("IDOR: user cannot read another user's ticket → 404", async () => {
  await createTicket({ user: userB, organization: null, body: { subject: "private", body: "secret" } }, makeRes(), rethrow);
  const res = makeRes();
  await getMyTicket({ user: userA, params: { id: tickets[0].id } }, res, rethrow);
  assert.equal(res.statusCode, 404);
});

test("closeTicket: owner closes; non-owner gets 404", async () => {
  await createTicket({ user: userA, organization: null, body: { subject: "tكت", body: "bbbbb" } }, makeRes(), rethrow);
  const id = tickets[0].id;

  const denied = makeRes();
  await closeTicket({ user: userB, params: { id } }, denied, rethrow);
  assert.equal(denied.statusCode, 404);

  const ok = makeRes();
  await closeTicket({ user: userA, params: { id } }, ok, rethrow);
  assert.equal(ok.body.status, "closed");
});

test("replyTicket: replying to a closed ticket is rejected (409, stays closed)", async () => {
  await createTicket({ user: userA, organization: null, body: { subject: "tكت", body: "bbbbb" } }, makeRes(), rethrow);
  const id = tickets[0].id;
  await closeTicket({ user: userA, params: { id } }, makeRes(), rethrow);
  assert.equal(tickets[0].status, "closed");

  const res = makeRes();
  await replyTicket({ user: userA, params: { id }, body: { body: "أي تحديث؟" } }, res, rethrow);
  assert.equal(res.statusCode, 409);
  assert.equal(tickets[0].status, "closed");
});

test("replyTicket: replying to an answered ticket reopens it to open", async () => {
  await createTicket({ user: userA, organization: null, body: { subject: "tكت", body: "bbbbb" } }, makeRes(), rethrow);
  const id = tickets[0].id;
  await adminReplyTicket({ user: admin, params: { id }, body: { body: "ردّ" } }, makeRes(), rethrow);
  assert.equal(tickets[0].status, "answered");

  const res = makeRes();
  await replyTicket({ user: userA, params: { id }, body: { body: "شكراً، سؤال آخر" } }, res, rethrow);
  assert.equal(res.statusCode, 201);
  assert.equal(tickets[0].status, "open");
});

// ── Public guest ─────────────────────────────────────────────────────────────

test("createGuestTicket: returns only public_token, no user/email echoed", async () => {
  const res = makeRes();
  await createGuestTicket({ body: { name: "زائر", email: "guest@x.com", subject: "استفسار", body: "سؤال عام" } }, res, rethrow);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(Object.keys(res.body).sort(), ["message", "public_token"]);
  assert.ok(res.body.public_token);
  assert.equal(tickets[0].guestEmail, "guest@x.com");
  assert.equal(messages[0].authorRole, "guest");
});

test("createGuestTicket: response is identical shape regardless of email (no enumeration)", async () => {
  const r1 = makeRes();
  await createGuestTicket({ body: { name: "a", email: "a@x.com", subject: "subj one", body: "body one" } }, r1, rethrow);
  const r2 = makeRes();
  await createGuestTicket({ body: { name: "b", email: "known@x.com", subject: "subj two", body: "body two" } }, r2, rethrow);
  assert.deepEqual(Object.keys(r1.body).sort(), Object.keys(r2.body).sort());
  assert.equal(r1.body.message, r2.body.message);
});

test("getGuestTicket: valid token → thread; random token → 404", async () => {
  await createGuestTicket({ body: { name: "زائر", email: "g@x.com", subject: "موضوع", body: "رسالة" } }, makeRes(), rethrow);
  const token = tickets[0].publicToken;

  const ok = makeRes();
  await getGuestTicket({ params: { token } }, ok, rethrow);
  assert.equal(ok.body.ticket.subject, "موضوع");
  assert.equal(ok.body.messages.length, 1);
  assert.equal(ok.body.ticket.public_token, undefined); // token never echoed in view

  const miss = makeRes();
  await getGuestTicket({ params: { token: randomUUID() } }, miss, rethrow);
  assert.equal(miss.statusCode, 404);
});

test("replyGuestTicket: appends guest message on an open ticket", async () => {
  await createGuestTicket({ body: { name: "زائر", email: "g@x.com", subject: "موضوع", body: "رسالة" } }, makeRes(), rethrow);
  const token = tickets[0].publicToken;

  const res = makeRes();
  await replyGuestTicket({ params: { token }, body: { body: "متابعة" } }, res, rethrow);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.author_role, "guest");
  assert.equal(tickets[0].status, "open");
});

test("replyGuestTicket: reply to a closed ticket is rejected (409)", async () => {
  await createGuestTicket({ body: { name: "زائر", email: "g@x.com", subject: "موضوع", body: "رسالة" } }, makeRes(), rethrow);
  const token = tickets[0].publicToken;
  await adminSetStatus({ user: admin, params: { id: tickets[0].id }, body: { status: "closed" } }, makeRes(), rethrow);

  const res = makeRes();
  await replyGuestTicket({ params: { token }, body: { body: "متابعة" } }, res, rethrow);
  assert.equal(res.statusCode, 409);
  assert.equal(tickets[0].status, "closed");
});

// ── Admin ────────────────────────────────────────────────────────────────────

test("adminReplyTicket: sets answered, message authorRole admin", async () => {
  await createTicket({ user: userA, organization: null, body: { subject: "tكت", body: "bbbbb" } }, makeRes(), rethrow);
  const id = tickets[0].id;

  const res = makeRes();
  await adminReplyTicket({ user: admin, params: { id }, body: { body: "تم الحل" } }, res, rethrow);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.author_role, "admin");
  assert.equal(tickets[0].status, "answered");
});

test("adminSetStatus: invalid status → 422; valid → applied", async () => {
  await createTicket({ user: userA, organization: null, body: { subject: "tكت", body: "bbbbb" } }, makeRes(), rethrow);
  const id = tickets[0].id;

  const bad = makeRes();
  await adminSetStatus({ user: admin, params: { id }, body: { status: "weird" } }, bad, rethrow);
  assert.equal(bad.statusCode, 422);

  const ok = makeRes();
  await adminSetStatus({ user: admin, params: { id }, body: { status: "closed" } }, ok, rethrow);
  assert.equal(ok.body.status, "closed");
});

test("adminListTickets: status filter + pagination metadata", async () => {
  await createTicket({ user: userA, organization: null, body: { subject: "open one", body: "bbbbb" } }, makeRes(), rethrow);
  await createTicket({ user: userB, organization: null, body: { subject: "closed one", body: "bbbbb" } }, makeRes(), rethrow);
  await adminSetStatus({ user: admin, params: { id: tickets[1].id }, body: { status: "closed" } }, makeRes(), rethrow);

  const res = makeRes();
  await adminListTickets({ user: admin, query: { status: "closed", page: "1", pageSize: "50" } }, res, rethrow);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.page, 1);
  assert.equal(res.body.pageSize, 50);
  assert.equal(res.body.data[0].subject, "closed one");
});

// ── Abuse hardening ───────────────────────────────────────────────────────────

test("createTicket: blocks a 6th open ticket per user (429)", async () => {
  for (let i = 0; i < 5; i++) {
    const r = makeRes();
    await createTicket({ user: userA, organization: null, body: { subject: `موضوع ${i}`, body: "نص الرسالة" } }, r, rethrow);
    assert.equal(r.statusCode, 201);
  }
  const res = makeRes();
  await createTicket({ user: userA, organization: null, body: { subject: "زائد", body: "نص الرسالة" } }, res, rethrow);
  assert.equal(res.statusCode, 429);
});

test("createGuestTicket: blocks too many open requests per email (429)", async () => {
  for (let i = 0; i < 5; i++) {
    const r = makeRes();
    await createGuestTicket({ body: { name: "زائر", email: "g@x.com", subject: `موضوع ${i}`, body: "نص الرسالة" } }, r, rethrow);
    assert.equal(r.statusCode, 201);
  }
  const res = makeRes();
  await createGuestTicket({ body: { name: "زائر", email: "g@x.com", subject: "زائد", body: "نص الرسالة" } }, res, rethrow);
  assert.equal(res.statusCode, 429);
  // A different email is unaffected.
  const other = makeRes();
  await createGuestTicket({ body: { name: "آخر", email: "other@x.com", subject: "موضوع", body: "نص الرسالة" } }, other, rethrow);
  assert.equal(other.statusCode, 201);
});

test("replyTicket: rejects once the thread hits the message cap (409)", async () => {
  await createTicket({ user: userA, organization: null, body: { subject: "موضوع", body: "نص الرسالة" } }, makeRes(), rethrow);
  const id = tickets[0].id;
  // Pad the thread to the cap (already has 1 message from creation).
  for (let i = 0; i < 199; i++) messages.push({ id: randomUUID(), ticketId: id, authorRole: "user", body: "x", createdAt: new Date() });

  const res = makeRes();
  await replyTicket({ user: userA, params: { id }, body: { body: "ردّ زائد" } }, res, rethrow);
  assert.equal(res.statusCode, 409);
});

test("getGuestTicket: a token resolving to a user's ticket is rejected (404)", async () => {
  await createTicket({ user: userA, organization: null, body: { subject: "خاص", body: "محتوى سري للغاية" } }, makeRes(), rethrow);
  const token = tickets[0].publicToken; // user tickets still carry a token in this fake

  const res = makeRes();
  await getGuestTicket({ params: { token } }, res, rethrow);
  assert.equal(res.statusCode, 404);
});
