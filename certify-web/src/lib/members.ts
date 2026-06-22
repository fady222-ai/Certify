"use client";

import { authedFetch } from "./auth";

export type Member = {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  role: "owner" | "admin" | "member";
  is_owner: boolean;
  monthly_limit: number | null;
  used_this_month: number;
  joined_at: string;
};

export type MembersResponse = {
  data: Member[];
  can_manage: boolean;
  limit: number;
};

export async function listMembers(): Promise<MembersResponse> {
  const res = await authedFetch("members");
  if (!res.ok) throw new Error("تعذر تحميل الأعضاء.");
  return res.json();
}

export async function createMember(input: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "member";
  monthlyLimit: number;
}): Promise<Member> {
  const res = await authedFetch("members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذر إضافة العضو.");
  return data;
}

export async function updateMember(
  id: string,
  patch: { role?: "admin" | "member"; monthlyLimit?: number },
): Promise<Member> {
  const res = await authedFetch(`members/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذر تحديث العضو.");
  return data;
}

export async function deleteMember(id: string): Promise<void> {
  const res = await authedFetch(`members/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? "تعذر إزالة العضو.");
  }
}

export const ROLE_LABELS: Record<string, string> = {
  owner: "المالك",
  admin: "مدير",
  member: "عضو",
};
