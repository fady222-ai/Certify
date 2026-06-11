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
 * Create a hosted-payment charge on Tap.
 * Returns { id, redirect_url } — redirect the user to redirect_url.
 */
export async function createCharge({ amount, currency = "SAR", org, user, planName, interval, callbackUrl }) {
  const description = `Certify — باقة ${planName} ${interval === "annual" ? "سنوي" : "شهري"}`;

  const charge = await tapRequest("POST", "/charges", {
    amount,
    currency,
    customer_initiated: true,
    threeDSecure: true,
    description,
    metadata: {
      org_id: org.id,
      org_slug: org.slug,
      interval,
    },
    customer: {
      first_name: user.name ?? "عميل",
      email: user.email,
    },
    source: { id: "src_all" },
    redirect: { url: callbackUrl },
  });

  return { id: charge.id, redirect_url: charge.transaction?.url ?? charge.url };
}

/**
 * Retrieve and verify a charge from Tap.
 */
export async function retrieveCharge(chargeId) {
  return tapRequest("GET", `/charges/${chargeId}`);
}

/**
 * Verify Tap webhook signature.
 * Tap sends hashDigest header = HMAC-SHA256(rawBody, webhookSecret).
 */
export function verifyWebhookSignature(rawBody, hashDigest) {
  if (!config.tapWebhookSecret) return true; // skip in dev if not configured
  const expected = crypto
    .createHmac("sha256", config.tapWebhookSecret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hashDigest ?? ""));
}
