import { authedFetch } from "./auth";
import { API_URL } from "./api";

export type TicketStatus = "open" | "answered" | "closed";

export type TicketRequester = {
  kind: "user" | "guest";
  name: string | null;
  email: string | null;
};

export type SupportTicket = {
  id: string;
  subject: string;
  status: TicketStatus;
  last_message_at: string;
  created_at: string;
  requester: TicketRequester;
  public_token?: string;
};

export type SupportMessage = {
  id: string;
  author_role: "user" | "admin" | "guest";
  body: string;
  created_at: string;
};

export type TicketDetail = { ticket: SupportTicket; messages: SupportMessage[] };

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "مفتوحة",
  answered: "تمت الإجابة",
  closed: "مغلقة",
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? "تعذر تنفيذ الطلب.");
  }
  return res.json() as Promise<T>;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

// ── Authenticated user ───────────────────────────────────────────────────────

export async function createTicket(subject: string, body: string): Promise<SupportTicket> {
  return json(
    await authedFetch("support/tickets", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ subject, body }),
    }),
  );
}

export async function listMyTickets(status?: TicketStatus): Promise<{ data: SupportTicket[]; total: number }> {
  const q = status ? `?status=${status}` : "";
  return json(await authedFetch(`support/tickets${q}`));
}

export async function getMyTicket(id: string): Promise<TicketDetail> {
  return json(await authedFetch(`support/tickets/${id}`));
}

export async function replyTicket(id: string, body: string): Promise<SupportMessage> {
  return json(
    await authedFetch(`support/tickets/${id}/messages`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ body }),
    }),
  );
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function adminListTickets(opts: {
  status?: TicketStatus;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ data: SupportTicket[]; total: number; page: number; pageSize: number }> {
  const qs = new URLSearchParams();
  if (opts.status) qs.set("status", opts.status);
  if (opts.search) qs.set("search", opts.search);
  if (opts.page) qs.set("page", String(opts.page));
  if (opts.pageSize) qs.set("pageSize", String(opts.pageSize));
  const q = qs.toString();
  return json(await authedFetch(`support/admin/tickets${q ? `?${q}` : ""}`));
}

export async function adminGetTicket(id: string): Promise<TicketDetail> {
  return json(await authedFetch(`support/admin/tickets/${id}`));
}

export async function adminReplyTicket(id: string, body: string): Promise<SupportMessage> {
  return json(
    await authedFetch(`support/admin/tickets/${id}/messages`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ body }),
    }),
  );
}

export async function adminSetStatus(id: string, status: TicketStatus): Promise<SupportTicket> {
  return json(
    await authedFetch(`support/admin/tickets/${id}/status`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ status }),
    }),
  );
}

// ── Public guest (no auth — plain fetch, like lib/api.ts) ─────────────────────

async function publicJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? "تعذر تنفيذ الطلب.");
  }
  return res.json() as Promise<T>;
}

export async function createGuestTicket(input: {
  name: string;
  email: string;
  subject: string;
  body: string;
}): Promise<{ public_token: string; message: string }> {
  return publicJson(
    await fetch(`${API_URL}/api/support/public/tickets`, {
      method: "POST",
      headers: { ...JSON_HEADERS, Accept: "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function getGuestTicket(token: string): Promise<TicketDetail> {
  return publicJson(
    await fetch(`${API_URL}/api/support/public/tickets/${encodeURIComponent(token)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }),
  );
}

export async function replyGuestTicket(token: string, body: string): Promise<SupportMessage> {
  return publicJson(
    await fetch(`${API_URL}/api/support/public/tickets/${encodeURIComponent(token)}/messages`, {
      method: "POST",
      headers: { ...JSON_HEADERS, Accept: "application/json" },
      body: JSON.stringify({ body }),
    }),
  );
}
