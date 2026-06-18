// Canonical plan catalogue — the single source of truth for plan *facts*
// (prices + monthly certificate quota + limits). `prisma/seed.js` writes these
// to the database, and the billing layer always charges/limits from the DB row
// by `slug`. The frontend keeps a display mirror in
// `certify-web/src/lib/pricing.ts`; `test/plan-pricing-sync.test.js` asserts the
// two never drift apart. Change a price or quota here and the seed + the guard
// test keep everything else honest.
export const PLANS = [
  { slug: "free",     name: "Free",     priceMonthly: 0,  priceYearly: 0,   certificatesPerMonth: 10,    teamMembersLimit: 1 },
  { slug: "starter",  name: "Starter",  priceMonthly: 9,  priceYearly: 90,  certificatesPerMonth: 200,   teamMembersLimit: 1 },
  { slug: "pro",      name: "Pro",      priceMonthly: 29, priceYearly: 290, certificatesPerMonth: 2000,  teamMembersLimit: 3, hasApi: true },
  { slug: "business", name: "Business", priceMonthly: 79, priceYearly: 790, certificatesPerMonth: 10000, teamMembersLimit: 10, hasApi: true, hasWhiteLabel: true },
];
