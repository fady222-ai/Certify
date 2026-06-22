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
};

export type Gateway = "stripe" | "tap" | "paymob";

const GATEWAYS: Gateway[] = ["stripe", "tap", "paymob"];

export type GatewayChoice =
  | { kind: "none" }
  | { kind: "direct"; gateway: Gateway }
  | { kind: "picker" };

/**
 * Decide how to take payment based on which gateways are available to customers.
 *   zero     → "none": no usable gateway; the page disables the pay button with a
 *              message instead of opening a dead-end picker full of disabled rows.
 *   exactly 1 → "direct": skip the picker, use that gateway.
 *   2 or more → "picker": let the customer choose (only available ones shown).
 * Keeping this here means /pricing and /dashboard/billing share one tested rule.
 */
export function resolveGatewayChoice(
  gateways: { stripe: boolean; tap: boolean; paymob: boolean },
): GatewayChoice {
  const available = GATEWAYS.filter((g) => gateways[g]);
  if (available.length === 0) return { kind: "none" };
  if (available.length === 1) return { kind: "direct", gateway: available[0] };
  return { kind: "picker" };
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
