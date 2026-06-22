// Display mirror of the plan facts shown across the site (landing page,
// /pricing, /dashboard/billing). The canonical source is the backend catalogue
// at certify-api/src/config/plans.js — the API always charges/limits from the
// DB by `slug`. These numbers MUST match it; certify-api's
// test/plan-pricing-sync.test.js fails CI if they drift.
//
// Only price-tier facts (name, price, monthly quota) live here. Marketing copy
// (feature bullets, tags, CTA labels) intentionally stays in each page.

export type PlanPricing = {
  slug: string;
  name: string;
  monthly: number; // USD / month
  yearly: number; // USD / year
  certsPerMonth: number; // monthly certificate quota (matches backend)
  certsLabel: string; // derived human label for the quota
  teamMembers: number; // team-member seats (matches backend teamMembersLimit)
  teamLabel: string; // derived human label for the seats
};

/** Arabic-correct quota label, derived from the numeric quota. */
function certsLabel(n: number): string {
  const noun = n >= 3 && n <= 10 ? "شهادات" : "شهادة";
  return `${n.toLocaleString("en-US")} ${noun} / شهر`;
}

/** Arabic-correct team-seats label, derived from the numeric seat count. */
function teamLabel(n: number): string {
  if (n <= 1) return "مستخدم واحد";
  if (n === 2) return "عضوا فريق";
  if (n <= 10) return `${n} أعضاء فريق`;
  return `${n} عضو فريق`;
}

function plan(slug: string, name: string, monthly: number, yearly: number, certsPerMonth: number, teamMembers: number): PlanPricing {
  return {
    slug, name, monthly, yearly, certsPerMonth,
    certsLabel: certsLabel(certsPerMonth),
    teamMembers, teamLabel: teamLabel(teamMembers),
  };
}

export const PLAN_PRICING: Record<string, PlanPricing> = {
  free:     plan("free",     "مجاني",    0,  0,   10,    1),
  pro:      plan("pro",      "Pro",      29, 290, 2000,  3),
  business: plan("business", "Business", 79, 790, 10000, 10),
};

/** Approximate % saved by paying yearly instead of monthly (≈ 2 months free). */
export const ANNUAL_SAVING_PCT = 17;
