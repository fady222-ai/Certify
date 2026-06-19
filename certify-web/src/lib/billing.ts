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
  has_bulk_issuance: boolean;
  has_api: boolean;
  has_white_label: boolean;
};

export type Gateway = "stripe" | "tap" | "paymob";

const GATEWAYS: Gateway[] = ["stripe", "tap", "paymob"];

/**
 * Decide whether the gateway picker is worth showing. With exactly one
 * configured gateway we use it directly; with two or more the user gets a real
 * choice. With zero configured we STILL open the picker — it lists every gateway
 * as "غير مفعلة" (disabled) so the user sees why payment isn't possible, rather
 * than silently firing a checkout the backend will refuse. Keeping this here
 * means /pricing and /dashboard/billing share one tested rule.
 */
export function resolveGatewayChoice(
  gateways: { stripe: boolean; tap: boolean; paymob: boolean },
): { showPicker: boolean; gateway: Gateway } {
  const available = GATEWAYS.filter((g) => gateways[g]);
  if (available.length === 1) return { showPicker: false, gateway: available[0] };
  return { showPicker: true, gateway: available[0] ?? "stripe" };
}

export type Subscription = {
  gateway: Gateway;
  status: "inactive" | "active" | "past_due" | "cancelled";
  interval: "monthly" | "annual";
  amount: number | null;
  currency: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  cancelled_at: string | null;
} | null;

export type Billing = {
  plan: Plan | null;
  subscription: Subscription;
  usage: { month: string; used: number; limit: number | null; remaining: number | null };
  gateways: { stripe: boolean; tap: boolean; paymob: boolean };
};

/** Public — list active plans + available gateways. */
export async function listPlans(): Promise<{ plans: Plan[]; gateways: { stripe: boolean; tap: boolean; paymob: boolean } }> {
  const res = await fetch(`${API_URL}/api/plans`, { headers: { Accept: "application/json" } });
  const data = await res.json();
  return { plans: data.data ?? [], gateways: data.gateways ?? { stripe: false, tap: false, paymob: false } };
}

/** Authed — current plan + usage + subscription. */
export async function getBilling(): Promise<Billing> {
  const res = await authedFetch("billing");
  if (!res.ok) throw new Error("تعذر تحميل بيانات الباقة.");
  return res.json();
}

/**
 * Authed — start checkout.
 * Returns { redirect_url } for paid plans, or { message } for free/dev-mode.
 */
export async function createCheckout(
  planSlug: string,
  interval: "monthly" | "annual",
  gateway: Gateway = "stripe",
): Promise<{ redirect_url?: string; message?: string; dev_mode?: boolean }> {
  const res = await authedFetch("billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_slug: planSlug, interval, gateway }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذر بدء عملية الدفع.");
  return data;
}

/** Authed — cancel active subscription at period end. */
export async function cancelSubscription(): Promise<{ message: string }> {
  const res = await authedFetch("billing/cancel", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذر إلغاء الاشتراك.");
  return data;
}
