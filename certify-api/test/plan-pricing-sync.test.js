// Guard test: the frontend pricing mirror (certify-web/src/lib/pricing.ts) must
// match the canonical backend plan catalogue (src/config/plans.js) for every
// plan's price and monthly quota. The frontend is a separate package (and its
// file is TypeScript), so instead of importing it we read it as text and pull
// the numbers out of the `plan(...)` factory calls. If anyone changes a price
// or quota on one side only, this fails and points at the mismatch.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PLANS } from "../src/config/plans.js";

const pricingPath = fileURLToPath(
  new URL("../../certify-web/src/lib/pricing.ts", import.meta.url),
);

/** Parse `plan("slug", "name", monthly, yearly, certsPerMonth, teamMembers)` lines. */
function parseFrontendPricing(src) {
  const re = /plan\(\s*"(\w+)"\s*,\s*"[^"]*"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
  const out = {};
  let m;
  while ((m = re.exec(src)) !== null) {
    out[m[1]] = {
      monthly: Number(m[2]),
      yearly: Number(m[3]),
      certsPerMonth: Number(m[4]),
      teamMembers: Number(m[5]),
    };
  }
  return out;
}

test("frontend pricing.ts mirrors the canonical backend plan catalogue", () => {
  const src = readFileSync(pricingPath, "utf8");
  const fe = parseFrontendPricing(src);

  // Sanity: the parser actually found every plan (guards against a format change
  // silently making this test pass with zero comparisons).
  assert.deepEqual(
    Object.keys(fe).sort(),
    PLANS.map((p) => p.slug).sort(),
    "frontend pricing.ts does not define the same set of plan slugs as the backend",
  );

  for (const p of PLANS) {
    const f = fe[p.slug];
    assert.ok(f, `frontend pricing.ts is missing plan "${p.slug}"`);
    assert.equal(f.monthly, p.priceMonthly, `monthly price mismatch for "${p.slug}"`);
    assert.equal(f.yearly, p.priceYearly, `yearly price mismatch for "${p.slug}"`);
    assert.equal(
      f.certsPerMonth,
      p.certificatesPerMonth,
      `monthly certificate quota mismatch for "${p.slug}"`,
    );
    assert.equal(
      f.teamMembers,
      p.teamMembersLimit,
      `team-member seats mismatch for "${p.slug}"`,
    );
  }
});
