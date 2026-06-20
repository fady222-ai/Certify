import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { encryptSecret, decryptSecret } from "../services/secretCrypto.js";
import { notifyNewTicket, notifyAdminReply, notifyCustomerReply } from "../services/supportMailer.js";

// The guest capability token: a random UUID handed out once. We store only its
// hash (lookup) + AES ciphertext (link rebuild), never the raw value.
const hashToken = (raw) => crypto.createHash("sha256").update(String(raw)).digest("hex");

// --- Validation ---------------------------------------------------------------

const createTicketSchema = z.object({
  subject: z.string().trim().min(3, "الموضوع مطلوب.").max(200),
  body: z.string().trim().min(5, "نص الرسالة مطلوب.").max(5000),
});

const guestCreateSchema = createTicketSchema.extend({
  name: z.string().trim().min(2, "الاسم مطلوب.").max(120),
  email: z.string().trim().email("بريد إلكتروني غير صالح.").max(160),
});

const replySchema = z.object({
  body: z.string().trim().min(1, "نص الرسالة مطلوب.").max(5000),
});

const STATUSES = ["open", "answered", "closed"];
const adminStatusSchema = z.object({ status: z.enum(STATUSES) });

const adminListQuery = z.object({
  status: z.enum(STATUSES).optional(),
  search: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

function validation(res, parsed) {
  return res.status(422).json({
    message: parsed.error.issues[0]?.message ?? "بيانات غير صالحة.",
    errors: parsed.error.flatten().fieldErrors,
  });
}

// Structural abuse caps (independent of IP rate limits, so IP rotation can't
// bypass them): a requester can't hold many open tickets at once, and a single
// thread can't be grown without bound.
const MAX_OPEN_TICKETS = 5;
const MAX_MESSAGES_PER_TICKET = 200;
const OPEN_STATES = ["open", "answered"];

// --- Presenters (snake_case) --------------------------------------------------

function presentTicket(t) {
  // The raw token is never reconstructable here (only hash/ciphertext stored), so
  // it is never part of any ticket payload — it lives only in the create response
  // and the emailed link.
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    last_message_at: t.lastMessageAt,
    created_at: t.createdAt,
    requester: {
      kind: t.userId ? "user" : "guest",
      name: t.user?.name ?? t.guestName ?? null,
      email: t.user?.email ?? t.guestEmail ?? null,
    },
  };
}

function presentMessage(m) {
  return {
    id: m.id,
    author_role: m.authorRole,
    body: m.body,
    created_at: m.createdAt,
  };
}

async function loadMessages(ticketId) {
  const messages = await prisma.supportMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
    take: MAX_MESSAGES_PER_TICKET, // bounded: a thread can't exceed this anyway
  });
  return messages.map(presentMessage);
}

// =============================================================================
// Authenticated user
// =============================================================================

/** POST /api/support/tickets */
export async function createTicket(req, res, next) {
  try {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) return validation(res, parsed);

    const openCount = await prisma.supportTicket.count({
      where: { userId: req.user.id, status: { in: OPEN_STATES } },
    });
    if (openCount >= MAX_OPEN_TICKETS) {
      return res.status(429).json({
        message: "لديك عدد كبير من التذاكر المفتوحة. انتظر الرد أو أغلق بعضها قبل فتح تذكرة جديدة.",
      });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: req.user.id,
        organizationId: req.organization?.id ?? null,
        subject: parsed.data.subject,
        status: "open",
        messages: { create: { authorRole: "user", authorId: req.user.id, body: parsed.data.body } },
      },
    });

    notifyNewTicket({ ...ticket, user: { name: req.user.name, email: req.user.email } });
    return res.status(201).json(presentTicket(ticket));
  } catch (e) {
    next(e);
  }
}

/** GET /api/support/tickets?status= */
export async function listMyTickets(req, res, next) {
  try {
    const where = { userId: req.user.id };
    const status = (req.query.status ?? "").toString().trim();
    if (STATUSES.includes(status)) where.status = status;

    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
    });
    return res.json({ data: tickets.map((t) => presentTicket(t)), total: tickets.length });
  } catch (e) {
    next(e);
  }
}

/** GET /api/support/tickets/:id */
export async function getMyTicket(req, res, next) {
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!ticket) return res.status(404).json({ message: "التذكرة غير موجودة." });
    return res.json({ ticket: presentTicket(ticket), messages: await loadMessages(ticket.id) });
  } catch (e) {
    next(e);
  }
}

/** POST /api/support/tickets/:id/messages */
export async function replyTicket(req, res, next) {
  try {
    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) return validation(res, parsed);

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!ticket) return res.status(404).json({ message: "التذكرة غير موجودة." });
    // A closed ticket is terminal — it can't be reopened by replying. The
    // customer must open a fresh ticket instead.
    if (ticket.status === "closed") {
      return res.status(409).json({ message: "هذه التذكرة مغلقة. افتح تذكرة جديدة لمتابعة الأمر." });
    }
    if ((await prisma.supportMessage.count({ where: { ticketId: ticket.id } })) >= MAX_MESSAGES_PER_TICKET) {
      return res.status(409).json({ message: "بلغت التذكرة الحد الأقصى للرسائل. افتح تذكرة جديدة." });
    }

    // Notify the admin only on the answered→open transition, not on every reply:
    // a burst of replies to an already-open ticket sends zero extra emails, so
    // the admin inbox can't be flooded regardless of IP rotation.
    const wasOpen = ticket.status === "open";
    const message = await prisma.supportMessage.create({
      data: { ticketId: ticket.id, authorRole: "user", authorId: req.user.id, body: parsed.data.body },
    });
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "open", lastMessageAt: new Date() },
    });

    if (!wasOpen) notifyCustomerReply({ ...ticket, user: { name: req.user.name, email: req.user.email } });
    return res.status(201).json(presentMessage(message));
  } catch (e) {
    next(e);
  }
}

// =============================================================================
// Public guest (token capability, no auth)
// =============================================================================

/** POST /api/support/public/tickets */
export async function createGuestTicket(req, res, next) {
  try {
    const parsed = guestCreateSchema.safeParse(req.body);
    if (!parsed.success) return validation(res, parsed);

    const openCount = await prisma.supportTicket.count({
      where: { guestEmail: parsed.data.email, status: { in: OPEN_STATES } },
    });
    if (openCount >= MAX_OPEN_TICKETS) {
      return res.status(429).json({
        message: "لديك عدد كبير من الطلبات المفتوحة. انتظر الرد قبل إرسال طلب جديد.",
      });
    }

    const rawToken = crypto.randomUUID();
    const ticket = await prisma.supportTicket.create({
      data: {
        guestName: parsed.data.name,
        guestEmail: parsed.data.email,
        subject: parsed.data.subject,
        status: "open",
        publicTokenHash: hashToken(rawToken),
        publicTokenEnc: encryptSecret(rawToken),
        messages: { create: { authorRole: "guest", body: parsed.data.body } },
      },
    });

    // The raw token is known only here — pass it to the mailer for the link.
    notifyNewTicket({ ...ticket, rawToken });
    // Return ONLY the token (the capability). No email/user data is echoed back,
    // and the ack is sent regardless of whether the email matches an account —
    // so this endpoint can't be used for email enumeration.
    return res.status(201).json({
      public_token: rawToken,
      message: "تم استلام رسالتك. تحقّق من بريدك لمتابعة الطلب.",
    });
  } catch (e) {
    next(e);
  }
}

/** GET /api/support/public/tickets/:token */
export async function getGuestTicket(req, res, next) {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { publicTokenHash: hashToken(req.params.token) },
    });
    // The token is a guest-only capability: a token that resolves to a
    // registered user's ticket is rejected (defense in depth; user tickets have
    // no token hash so this is also unreachable structurally).
    if (!ticket || ticket.userId) return res.status(404).json({ message: "الطلب غير موجود." });
    return res.json({ ticket: presentTicket(ticket), messages: await loadMessages(ticket.id) });
  } catch (e) {
    next(e);
  }
}

/** POST /api/support/public/tickets/:token/messages */
export async function replyGuestTicket(req, res, next) {
  try {
    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) return validation(res, parsed);

    const ticket = await prisma.supportTicket.findUnique({
      where: { publicTokenHash: hashToken(req.params.token) },
    });
    if (!ticket || ticket.userId) return res.status(404).json({ message: "الطلب غير موجود." });
    // Closed is terminal — the guest must submit a new request instead.
    if (ticket.status === "closed") {
      return res.status(409).json({ message: "هذا الطلب مغلق. أرسل طلباً جديداً لمتابعة الأمر." });
    }
    if ((await prisma.supportMessage.count({ where: { ticketId: ticket.id } })) >= MAX_MESSAGES_PER_TICKET) {
      return res.status(409).json({ message: "بلغ الطلب الحد الأقصى للرسائل. أرسل طلباً جديداً." });
    }

    const wasOpen = ticket.status === "open";
    const message = await prisma.supportMessage.create({
      data: { ticketId: ticket.id, authorRole: "guest", body: parsed.data.body },
    });
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "open", lastMessageAt: new Date() },
    });

    if (!wasOpen) notifyCustomerReply(ticket);
    return res.status(201).json(presentMessage(message));
  } catch (e) {
    next(e);
  }
}

// =============================================================================
// Admin
// =============================================================================

/** GET /api/support/admin/tickets?status=&search=&page=&pageSize= */
export async function adminListTickets(req, res, next) {
  try {
    const parsed = adminListQuery.safeParse(req.query);
    if (!parsed.success) return validation(res, parsed);
    const { status, search, page, pageSize } = parsed.data;

    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { guestName: { contains: search, mode: "insensitive" } },
        { guestEmail: { contains: search, mode: "insensitive" } },
        { user: { is: { name: { contains: search, mode: "insensitive" } } } },
        { user: { is: { email: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { lastMessageAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return res.json({ data: data.map((t) => presentTicket(t)), total, page, pageSize });
  } catch (e) {
    next(e);
  }
}

/** GET /api/support/admin/tickets/:id */
export async function adminGetTicket(req, res, next) {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!ticket) return res.status(404).json({ message: "التذكرة غير موجودة." });
    return res.json({
      ticket: presentTicket(ticket),
      messages: await loadMessages(ticket.id),
    });
  } catch (e) {
    next(e);
  }
}

/** POST /api/support/admin/tickets/:id/messages */
export async function adminReplyTicket(req, res, next) {
  try {
    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) return validation(res, parsed);

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!ticket) return res.status(404).json({ message: "التذكرة غير موجودة." });

    const message = await prisma.supportMessage.create({
      data: { ticketId: ticket.id, authorRole: "admin", authorId: req.user.id, body: parsed.data.body },
    });
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "answered", lastMessageAt: new Date() },
    });

    // Rebuild the guest's link from the stored ciphertext (raw token isn't kept).
    let rawToken = null;
    if (ticket.publicTokenEnc) {
      try { rawToken = decryptSecret(ticket.publicTokenEnc); } catch { rawToken = null; }
    }
    notifyAdminReply({ ...ticket, rawToken });
    return res.status(201).json(presentMessage(message));
  } catch (e) {
    next(e);
  }
}

/** PATCH /api/support/admin/tickets/:id/status */
export async function adminSetStatus(req, res, next) {
  try {
    const parsed = adminStatusSchema.safeParse(req.body);
    if (!parsed.success) return validation(res, parsed);

    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ message: "التذكرة غير موجودة." });

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: parsed.data.status },
      include: { user: { select: { name: true, email: true } } },
    });
    return res.json(presentTicket(updated));
  } catch (e) {
    next(e);
  }
}
