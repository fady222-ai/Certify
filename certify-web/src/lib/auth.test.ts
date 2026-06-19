import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getStoredUser,
  getToken,
  logout,
  login,
  verifyEmail,
  authedFetch,
  register,
  resendOtp,
  forgotPassword,
  resetPassword,
  refreshProfile,
} from "./auth";

const USER_KEY = "certify_user";
const TOKEN_KEY = "certify_token";

const sampleProfile = {
  user: { id: "u1", name: "أحمد", email: "a@x.com", locale: "ar" },
  organization: null,
};

function mockFetch(status: number, body: unknown) {
  global.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("stored profile handling", () => {
  test("getStoredUser returns null when nothing is stored", () => {
    expect(getStoredUser()).toBeNull();
  });

  test("getStoredUser parses a valid stored profile", () => {
    localStorage.setItem(USER_KEY, JSON.stringify(sampleProfile));
    expect(getStoredUser()).toEqual(sampleProfile);
  });

  test("getStoredUser clears a corrupted profile and returns null", () => {
    localStorage.setItem(USER_KEY, "{not json");
    expect(getStoredUser()).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull(); // self-heals
  });

  test("logout clears both token and profile", () => {
    localStorage.setItem(TOKEN_KEY, "t");
    localStorage.setItem(USER_KEY, JSON.stringify(sampleProfile));
    logout();
    expect(getToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });
});

describe("login", () => {
  test("persists token + profile on success", async () => {
    mockFetch(200, { token: "jwt-abc", ...sampleProfile });
    const result = await login({ identifier: "a@x.com", password: "secret" });
    expect(result).toEqual(sampleProfile);
    expect(getToken()).toBe("jwt-abc");
    expect(getStoredUser()).toEqual(sampleProfile);
  });

  test("returns the verification hint (without persisting) on a 403 unverified response", async () => {
    mockFetch(403, { userId: "u1", requires_verification: true, message: "فعل بريدك" });
    const result = await login({ identifier: "a@x.com", password: "secret" });
    expect(result).toMatchObject({ requires_verification: true, userId: "u1" });
    expect(getToken()).toBeNull(); // not logged in yet
  });

  test("throws the server message on failure", async () => {
    mockFetch(401, { message: "بيانات غير صحيحة" });
    await expect(login({ identifier: "a@x.com", password: "wrong" })).rejects.toThrow("بيانات غير صحيحة");
  });
});

describe("verifyEmail", () => {
  test("persists the session once the code is accepted", async () => {
    mockFetch(200, { token: "jwt-xyz", ...sampleProfile });
    const profile = await verifyEmail("u1", "123456");
    expect(profile).toEqual(sampleProfile);
    expect(getToken()).toBe("jwt-xyz");
  });
});

describe("register (step 1 of two-step signup)", () => {
  test("returns the verification handle without logging in yet", async () => {
    mockFetch(201, { userId: "u1", requires_verification: true });
    const result = await register({ name: "أحمد", email: "a@x.com", password: "secret123" });
    expect(result).toMatchObject({ userId: "u1", requires_verification: true });
    expect(getToken()).toBeNull(); // no session until the email is verified
    expect(getStoredUser()).toBeNull();
  });

  test("throws the server message on failure (e.g. email already taken)", async () => {
    mockFetch(409, { message: "البريد مستخدم بالفعل" });
    await expect(
      register({ name: "أحمد", email: "a@x.com", password: "secret123" }),
    ).rejects.toThrow("البريد مستخدم بالفعل");
  });
});

describe("resendOtp", () => {
  test("resolves on success", async () => {
    mockFetch(200, {});
    await expect(resendOtp("u1")).resolves.toBeUndefined();
  });

  test("throws the server message on failure (e.g. rate limited)", async () => {
    mockFetch(429, { message: "حاول لاحقا" });
    await expect(resendOtp("u1")).rejects.toThrow("حاول لاحقا");
  });
});

describe("password recovery", () => {
  test("forgotPassword resolves on success", async () => {
    mockFetch(200, {});
    await expect(forgotPassword("a@x.com")).resolves.toBeUndefined();
  });

  test("resetPassword resolves on success", async () => {
    mockFetch(200, {});
    await expect(resetPassword("reset-token", "newsecret1")).resolves.toBeUndefined();
  });

  test("resetPassword throws the server message on an invalid/expired token", async () => {
    mockFetch(400, { message: "الرمز غير صالح أو منته" });
    await expect(resetPassword("bad-token", "newsecret1")).rejects.toThrow("الرمز غير صالح أو منته");
  });
});

describe("refreshProfile", () => {
  test("re-persists the freshened profile when authorized", async () => {
    localStorage.setItem(TOKEN_KEY, "jwt-123");
    const fresh = { user: { id: "u1", name: "أحمد جديد", email: "a@x.com", locale: "ar" }, organization: null };
    mockFetch(200, fresh);
    const result = await refreshProfile();
    expect(result).toEqual(fresh);
    expect(getStoredUser()).toEqual(fresh); // local cache updated
  });

  test("returns null when the profile endpoint errors (non-401)", async () => {
    localStorage.setItem(TOKEN_KEY, "jwt-123");
    mockFetch(500, {});
    expect(await refreshProfile()).toBeNull();
  });
});

describe("authedFetch", () => {
  test("logs out and throws when the API returns 401", async () => {
    localStorage.setItem(TOKEN_KEY, "stale-jwt");
    localStorage.setItem(USER_KEY, JSON.stringify(sampleProfile));
    mockFetch(401, {});
    await expect(authedFetch("auth/me")).rejects.toThrow(/انتهت الجلسة/);
    expect(getToken()).toBeNull(); // session cleared on 401
  });

  test("attaches the bearer token when present", async () => {
    localStorage.setItem(TOKEN_KEY, "jwt-123");
    const spy = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, status: 200, json: async () => ({}) }));
    global.fetch = spy as unknown as typeof fetch;
    await authedFetch("auth/me");
    const headers = (spy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt-123");
  });
});
