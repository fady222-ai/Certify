"use client";

import { API_URL } from "./api";

const TOKEN_KEY = "certify_token";
const USER_KEY = "certify_user";

export type AuthUser = {
  user: { id: string; name: string; email: string; locale: string };
  organization: {
    id: string;
    name: string;
    slug: string;
    primary_color: string;
    logo_url: string | null;
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
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

function persist(token: string, profile: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(profile));
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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
}): Promise<AuthUser> {
  const { token, user, organization } = await postAuth("auth/register", input);
  const profile = { user, organization };
  persist(token, profile);
  return profile;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const { token, user, organization } = await postAuth("auth/login", input);
  const profile = { user, organization };
  persist(token, profile);
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
    throw new Error("انتهت الجلسة. يرجى تسجيل الدخول مجدداً.");
  }
  return res;
}
