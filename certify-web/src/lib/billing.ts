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

export type Subscription = {
  status: "inactive" | "active" | "past_due" | "cancelled";
  interval: "monthly" | "annual";
  amount: number | null;
  currency: string;
  current_period_end: string | null;
  cancelled_at: string | null;
} | null;

export type Billing = {
  plan: Plan | null;
  subscription: Subscription;
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

/** Authed — current plan + usage + subscription. */
export async function getBilling(): Promise<Billing> {
  const res = await authedFetch("billing");
  if (!res.ok) throw new Error("تعذّر تحميل بيانات الباقة.");
  return res.json();
}

/**
 * Authed — start checkout with Tap Payments.
 * For free plan returns { message } directly; for paid plans returns { redirect_url }.
 */
export async function createCheckout(
  planSlug: string,
  interval: "monthly" | "annual",
): Promise<{ redirect_url?: string; message?: string; dev_mode?: boolean }> {
  const res = await authedFetch("billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_slug: planSlug, interval }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذّر بدء عملية الدفع.");
  return data;
}

/** Authed — cancel active subscription. */
export async function cancelSubscription(): Promise<{ message: string }> {
  const res = await authedFetch("billing/cancel", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذّر إلغاء الاشتراك.");
  return data;
}
