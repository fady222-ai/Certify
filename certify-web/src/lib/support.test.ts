import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createGuestTicket, getGuestTicket, replyGuestTicket,
  createTicket, adminListTickets,
} from "./support";

const TOKEN_KEY = "certify_token";

function mockFetch(status: number, body: unknown) {
  const spy = vi.fn(async (..._args: unknown[]) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  global.fetch = spy as unknown as typeof fetch;
  return spy;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("public guest API (no auth)", () => {
  test("createGuestTicket POSTs to the public path with no Authorization header", async () => {
    const spy = mockFetch(201, { public_token: "tok-123", message: "ok" });
    const res = await createGuestTicket({ name: "زائر", email: "g@x.com", subject: "موضوع", body: "رسالة" });

    expect(res.public_token).toBe("tok-123");
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/support/public/tickets");
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body as string)).toMatchObject({ name: "زائر", email: "g@x.com" });
  });

  test("getGuestTicket throws an Arabic message on 404", async () => {
    mockFetch(404, { message: "الطلب غير موجود." });
    await expect(getGuestTicket("missing")).rejects.toThrow(/غير موجود/);
  });

  test("getGuestTicket url-encodes the token", async () => {
    const spy = mockFetch(200, { ticket: {}, messages: [] });
    await getGuestTicket("a/b c");
    expect((spy.mock.calls[0][0] as string)).toContain("a%2Fb%20c");
  });

  test("replyGuestTicket posts the body to the token messages path", async () => {
    const spy = mockFetch(201, { id: "m1", author_role: "guest", body: "hi", created_at: "" });
    await replyGuestTicket("tok-9", "متابعة");
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/support/public/tickets/tok-9/messages");
    expect(JSON.parse(init.body as string)).toEqual({ body: "متابعة" });
  });
});

describe("authenticated API", () => {
  test("createTicket attaches the bearer token", async () => {
    localStorage.setItem(TOKEN_KEY, "jwt-abc");
    const spy = mockFetch(201, { id: "t1", status: "open" });
    await createTicket("موضوع", "نص الرسالة");

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/support/tickets");
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt-abc");
  });

  test("createTicket throws the server message on failure", async () => {
    localStorage.setItem(TOKEN_KEY, "jwt-abc");
    mockFetch(422, { message: "الموضوع مطلوب." });
    await expect(createTicket("x", "y")).rejects.toThrow(/الموضوع مطلوب/);
  });

  test("adminListTickets builds the query string with status/search/page", async () => {
    localStorage.setItem(TOKEN_KEY, "jwt-abc");
    const spy = mockFetch(200, { data: [], total: 0, page: 2, pageSize: 50 });
    await adminListTickets({ status: "open", search: "بحث", page: 2, pageSize: 50 });

    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("status=open");
    expect(url).toContain("page=2");
    expect(url).toContain("pageSize=50");
    expect(url).toContain("search=");
  });
});
