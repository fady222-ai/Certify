"use client";

import { API_URL } from "./api";

const TOKEN_KEY = "certify_token";
const USER_KEY = "certify_user";

export type AuthUser = {
  user: { id: string; name: string; email: string; locale: string; is_admin?: boolean; mfa_enabled?: boolean };
  organization: {
    id: string;
    name: string;
    slug: string;
    primary_color: string;
    logo_url: string | null;
    suspended?: boolean;
    plan: { slug: string; name: string; certificates_per_month: number } | null;
  } | null;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    // Corrupted stored profile — clear it so the app falls back to logged-out.
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function persist(token: string, profile: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(profile));
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function serverLogout(): Promise<void> {
  try {
    await authedFetch("auth/logout", { method: "POST" });
  } catch {
    // best-effort — always clear local state
  } finally {
    logout();
  }
}

type ApiError = { message?: string };

async function postAuth(path: string, body: unknown) {
  const res = await fetch(`${API_URL}/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as ApiError).message ?? "حدث خطأ ما.");
  }
  return data as { token: string } & AuthUser;
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  organizationName?: string;
}): Promise<{ userId: string; requires_verification: true }> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message ?? "حدث خطأ ما.");
  return data as { userId: string; requires_verification: true };
}

export async function verifyEmail(userId: string, code: string): Promise<AuthUser> {
  const { token, user, organization } = await postAuth("auth/verify-email", { userId, code });
  const profile = { user, organization };
  persist(token, profile);
  return profile;
}

export async function resendOtp(userId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/resend-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message ?? "حدث خطأ ما.");
}

export async function forgotPassword(email: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message ?? "حدث خطأ ما.");
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message ?? "حدث خطأ ما.");
}

export async function login(input: {
  identifier: string;
  password: string;
}): Promise<
  | AuthUser
  | { userId: string; requires_verification: true; message: string }
  | { requires_mfa: true; mfa_token: string }
> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 403 && (data as { requires_verification?: boolean }).requires_verification) {
    return data as { userId: string; requires_verification: true; message: string };
  }
  // Password OK but MFA on — caller must complete verifyMfa with the challenge token.
  if (res.ok && (data as { requires_mfa?: boolean }).requires_mfa) {
    return data as { requires_mfa: true; mfa_token: string };
  }
  if (!res.ok) throw new Error((data as { message?: string }).message ?? "حدث خطأ ما.");
  const { token, user, organization } = data as { token: string } & AuthUser;
  const profile = { user, organization };
  persist(token, profile);
  return profile;
}

/** Step 2 of login: submit the MFA challenge token + a TOTP/backup code. */
export async function verifyMfa(mfaToken: string, code: string): Promise<AuthUser> {
  const { token, user, organization } = await postAuth("auth/mfa/verify", { mfa_token: mfaToken, code });
  const profile = { user, organization };
  persist(token, profile);
  return profile;
}

export async function setupMfa(): Promise<{ qr_data_url: string; otpauth_uri: string; secret: string }> {
  const res = await authedFetch("auth/mfa/setup", { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message ?? "تعذر بدء الإعداد.");
  return data as { qr_data_url: string; otpauth_uri: string; secret: string };
}

export async function enableMfa(code: string): Promise<{ backup_codes: string[] }> {
  const res = await authedFetch("auth/mfa/enable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message ?? "تعذر التفعيل.");
  return data as { backup_codes: string[] };
}

export async function disableMfa(code: string): Promise<void> {
  const res = await authedFetch("auth/mfa/disable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? "تعذر التعطيل.");
  }
}

/** Re-fetch the profile from /auth/me and update local storage. */
export async function refreshProfile(): Promise<AuthUser | null> {
  const res = await authedFetch("auth/me");
  if (!res.ok) return null;
  const profile = (await res.json()) as AuthUser;
  const token = getToken();
  if (token) persist(token, profile);
  return profile;
}

/** Fetch wrapper that attaches the bearer token. */
export async function authedFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error("انتهت الجلسة. يرجى تسجيل الدخول مجددا.");
  }
  return res;
}
