"use client";

import { API_URL } from "./api";
import { authedFetch } from "./auth";

export type Plan = {
  id: number;
  slug: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  certificates_per_month: number;
  templates_limit: number | null;
  team_members_limit: number;
  has_api: boolean;
  has_white_label: boolean;
};

export type Billing = {
  plan: Plan | null;
  usage: {
    month: string;
    used: number;
    limit: number | null;
    remaining: number | null;
  };
};

/** Public — list active plans. */
export async function listPlans(): Promise<Plan[]> {
  const res = await fetch(`${API_URL}/api/plans`, { headers: { Accept: "application/json" } });
  const data = await res.json();
  return data.data ?? [];
}

/** Authed — current plan + usage. */
export async function getBilling(): Promise<Billing> {
  const res = await authedFetch("billing");
  if (!res.ok) throw new Error("تعذّر تحميل بيانات الباقة.");
  return res.json();
}

/** Authed — switch plan (dev-mode for paid plans). */
export async function changePlan(slug: string): Promise<{ message: string; requires_payment: boolean }> {
  const res = await authedFetch("billing/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذّر تغيير الباقة.");
  return data;
}
