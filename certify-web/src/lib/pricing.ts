// Single source of truth for the plan prices shown across the marketing site
// (landing page + /pricing). These values MUST match the canonical plans in
// certify-api/prisma/seed.js — the backend always charges from the database by
// `slug`, so keeping the displayed numbers here in one place prevents the two
// pages from drifting apart (or from the real price).
//
// Marketing copy (feature bullets, tags, CTA labels) intentionally stays in
// each page — only the price-tier facts (name, price, monthly quota) live here.

export type PlanPricing = {
  slug: string;
  name: string;
  monthly: number; // USD / month
  yearly: number; // USD / year
  certsLabel: string; // human label for the monthly certificate quota
};

export const PLAN_PRICING: Record<string, PlanPricing> = {
  free:     { slug: "free",     name: "مجاني",    monthly: 0,  yearly: 0,   certsLabel: "10 شهادات / شهر" },
  starter:  { slug: "starter",  name: "Starter",  monthly: 9,  yearly: 90,  certsLabel: "200 شهادة / شهر" },
  pro:      { slug: "pro",      name: "Pro",      monthly: 29, yearly: 290, certsLabel: "2,000 شهادة / شهر" },
  business: { slug: "business", name: "Business", monthly: 79, yearly: 790, certsLabel: "10,000 شهادة / شهر" },
};

/** Approximate % saved by paying yearly instead of monthly (≈ 2 months free). */
export const ANNUAL_SAVING_PCT = 17;
