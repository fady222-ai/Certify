import { describe, test, expect, vi, afterEach } from "vitest";
import { verifyCertificate } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("verifyCertificate", () => {
  test("returns the verification payload on success", async () => {
    const payload = { found: true, valid: true, certificate: { recipient_name: "أحمد" } };
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => payload })) as unknown as typeof fetch;
    const result = await verifyCertificate("CERT-AB12-CD34-EF56-GH78");
    expect(result.found).toBe(true);
    expect(result.valid).toBe(true);
  });

  test("maps a 404 to a not-found result with the server message", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ message: "غير موجودة" }) })) as unknown as typeof fetch;
    const result = await verifyCertificate("CERT-0000");
    expect(result).toEqual({ found: false, message: "غير موجودة" });
  });

  test("degrades gracefully to not-found on a network error", async () => {
    global.fetch = vi.fn(async () => { throw new Error("network down"); }) as unknown as typeof fetch;
    const result = await verifyCertificate("CERT-0000");
    expect(result.found).toBe(false);
    expect(result.message).toMatch(/تعذّر الاتصال/);
  });

  test("url-encodes the verification code", async () => {
    const spy = vi.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => ({ found: true }) }));
    global.fetch = spy as unknown as typeof fetch;
    await verifyCertificate("a/b c");
    expect(spy.mock.calls[0][0]).toContain("a%2Fb%20c");
  });
});
