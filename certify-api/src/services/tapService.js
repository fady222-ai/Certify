import crypto from "node:crypto";
import { config } from "../config/index.js";

const TAP_API = "https://api.tap.company/v2";

async function tapRequest(method, path, body) {
  const res = await fetch(`${TAP_API}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${config.tapSecretKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json?.errors?.[0]?.description ?? json?.message ?? "Tap API error");
    err.statusCode = res.status;
    throw err;
  }
  return json;
}

/**
 * Create a hosted-payment charge on Tap with card save enabled.
 * Returns { id, redirect_url }.
 */
export async function createCharge({ amount, currency = "USD", org, user, planName, interval, callbackUrl }) {
  const description = `Certify — ${planName} ${interval === "annual" ? "Annual" : "Monthly"}`;

  const charge = await tapRequest("POST", "/charges", {
    amount,
    currency,
    customer_initiated: true,
    threeDSecure: true,
    save_card: true,
    description,
    metadata: { org_id: org.id, org_slug: org.slug, interval },
    customer: { first_name: user.name ?? "Customer", email: user.email },
    source: { id: "src_all" },
    redirect: { url: callbackUrl },
  });

  return {
    id: charge.id,
    redirect_url: charge.transaction?.url ?? charge.url,
    customer_id: charge.customer?.id ?? null,
    card_id: charge.card?.id ?? null,
  };
}

/**
 * Create a merchant-initiated (MIT) charge on a saved card (for auto-renewal).
 */
export async function createTokenCharge({ amount, currency = "USD", customerId, cardId, description }) {
  return tapRequest("POST", "/charges", {
    amount,
    currency,
    customer_initiated: false,
    threeDSecure: false,
    description,
    customer: { id: customerId },
    source: { id: cardId },
  });
}

/**
 * Retrieve a charge from Tap.
 */
export async function retrieveCharge(chargeId) {
  return tapRequest("GET", `/charges/${chargeId}`);
}

/**
 * Verify Tap webhook signature.
 * Tap sends hashDigest header = HMAC-SHA256(rawBody, webhookSecret).
 */
export function verifyWebhookSignature(rawBody, hashDigest) {
  if (!config.tapWebhookSecret) {
    // In production a missing secret means we cannot trust the payload — reject
    // rather than silently accept forged webhooks. Only skipped in dev.
    return !config.isProduction;
  }
  const expected = crypto
    .createHmac("sha256", config.tapWebhookSecret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hashDigest ?? ""));
  } catch {
    return false;
  }
}

export function isConfigured() {
  return !!config.tapSecretKey;
}
