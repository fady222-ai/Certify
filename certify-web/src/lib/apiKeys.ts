"use client";

import { authedFetch } from "./auth";

export type ApiKey = {
  id: string;
  name: string;
  masked: string;
  last_used_at: string | null;
  revoked: boolean;
  created_at: string;
};

export type ApiKeysResponse = {
  data: ApiKey[];
  has_api: boolean;
};

export async function listApiKeys(): Promise<ApiKeysResponse> {
  const res = await authedFetch("api-keys");
  if (!res.ok) throw new Error("تعذر تحميل المفاتيح.");
  return res.json();
}

/** Create a key; the raw secret is returned exactly once (in `key`). */
export async function createApiKey(name: string): Promise<ApiKey & { key: string }> {
  const res = await authedFetch("api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذر إنشاء المفتاح.");
  return data;
}

export async function revokeApiKey(id: string): Promise<void> {
  const res = await authedFetch(`api-keys/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? "تعذر إلغاء المفتاح.");
  }
}
