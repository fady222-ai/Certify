import crypto from "node:crypto";
import { config } from "../config/index.js";
import { paymobConfig, isGatewayAvailable } from "./gatewayConfig.js";

const BASE = "https://accept.paymob.com/api";

async function authToken() {
  const res = await fetch(`${BASE}/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: paymobConfig().apiKey }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Paymob authentication failed");
  return data.token;
}

async function createOrder(token, { amountCents, merchantOrderId }) {
  const res = await fetch(`${BASE}/ecommerce/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      amount_cents: amountCents,
      currency: "EGP",
      delivery_needed: false,
      merchant_order_id: merchantOrderId,
      items: [],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Paymob order creation failed");
  return data;
}

async function requestPaymentKey(token, { orderId, amountCents, billingData, saveCard }) {
  const res = await fetch(`${BASE}/payment_keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      amount_cents: amountCents,
      expiration: 3600,
      order_id: orderId,
      billing_data: billingData,
      currency: "EGP",
      integration_id: parseInt(paymobConfig().integrationId),
      lock_order_when_paid: false,
      ...(saveCard ? { save_card: true } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Paymob payment key request failed");
  return data.token;
}

function buildBillingData(user) {
  const parts = (user.name ?? "Customer").split(" ");
  return {
    email: user.email,
    first_name: parts[0] ?? "Customer",
    last_name: parts.slice(1).join(" ") || "NA",
    phone_number: "NA",
    apartment: "NA",
    floor: "NA",
    street: "NA",
    building: "NA",
    shipping_method: "NA",
    postal_code: "NA",
    city: "Cairo",
    country: "EG",
    state: "NA",
  };
}

/**
 * Start a hosted Paymob checkout (hosted iframe — supports cards, Vodafone Cash, InstaPay, Fawry, Meeza).
 * Returns { paymobOrderId, merchantOrderId, amountEgp, redirect_url }.
 */
export async function createHostedCheckout({ amountUsd, plan, org, user }) {
  const amountEgp = Math.round(amountUsd * paymobConfig().egpRate);
  const amountCents = amountEgp * 100;
  const merchantOrderId = `certify_${org.id}_${Date.now()}`;

  const token = await authToken();
  const order = await createOrder(token, { amountCents, merchantOrderId });
  const paymentKey = await requestPaymentKey(token, {
    orderId: order.id,
    amountCents,
    billingData: buildBillingData(user),
    saveCard: true,
  });

  return {
    paymobOrderId: String(order.id),
    merchantOrderId,
    amountEgp,
    redirect_url: `https://accept.paymob.com/api/acceptance/iframes/${paymobConfig().iframeId}?payment_token=${paymentKey}`,
  };
}

/**
 * Charge a saved card token (merchant-initiated, for subscription renewals).
 * Returns { id, success, status }.
 */
export async function createTokenCharge({ amountUsd, cardToken, description }) {
  const amountEgp = Math.round(amountUsd * paymobConfig().egpRate);
  const amountCents = amountEgp * 100;
  const merchantOrderId = `certify_renew_${Date.now()}`;

  const token = await authToken();
  const order = await createOrder(token, { amountCents, merchantOrderId });

  const paymentKey = await requestPaymentKey(token, {
    orderId: order.id,
    amountCents,
    billingData: buildBillingData({ name: "Certify Renewal", email: "renewal@certify.app" }),
    saveCard: false,
  });

  const res = await fetch(`${BASE}/acceptance/payments/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: { identifier: cardToken, subtype: "TOKEN" },
      payment_token: paymentKey,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Paymob token charge failed");

  return {
    id: String(data.id ?? ""),
    success: data.success === true,
    status: data.success === true ? "CAPTURED" : "FAILED",
  };
}

/**
 * Verify Paymob HMAC-SHA512 signature.
 * Works for both the GET callback (flat query params) and POST webhook (obj fields).
 * Paymob computes HMAC over these 20 fields in exactly this order.
 */
export function verifyHmac(params, receivedHmac) {
  const { hmacSecret } = paymobConfig();
  if (!hmacSecret) {
    // In production refuse to trust an unsigned payload; only skip in dev.
    return !config.isProduction;
  }
  const str = [
    params.amount_cents,
    params.created_at,
    params.currency,
    params.error_occured,
    params.has_parent_transaction,
    params.id,
    params.integration_id,
    params.is_3d_secure,
    params.is_auth,
    params.is_capture,
    params.is_refunded,
    params.is_standalone_payment,
    params.is_voided,
    params.order,
    params.owner,
    params.pending,
    params["source_data.pan"],
    params["source_data.sub_type"],
    params["source_data.type"],
    params.success,
  ]
    .map((v) => String(v ?? ""))
    .join("");
  const computed = crypto.createHmac("sha512", hmacSecret).update(str).digest("hex");
  // Constant-time comparison to avoid leaking the HMAC via timing.
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(String(receivedHmac ?? "")));
  } catch {
    return false;
  }
}

export function isConfigured() {
  return isGatewayAvailable("paymob");
}
