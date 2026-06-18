import Stripe from "stripe";
import { stripeConfig, isGatewayAvailable } from "./gatewayConfig.js";

function getStripe() {
  const { secretKey } = stripeConfig();
  if (!secretKey) return null;
  return new Stripe(secretKey, { apiVersion: "2024-11-20.acacia" });
}

/**
 * Get or create a Stripe customer for this user.
 */
async function ensureCustomer(stripe, user, existingCustomerId) {
  if (existingCustomerId) return existingCustomerId;
  const customer = await stripe.customers.create({ email: user.email, name: user.name });
  return customer.id;
}

/**
 * Create a Stripe Checkout Session (subscription mode).
 * Uses inline price_data — no Products needed in dashboard.
 */
export async function createCheckoutSession({ plan, interval, org, user, existingCustomerId, successUrl, cancelUrl }) {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");

  const amount = interval === "annual" ? plan.priceYearly : plan.priceMonthly;
  const customerId = await ensureCustomer(stripe, user, existingCustomerId);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          recurring: { interval: interval === "annual" ? "year" : "month" },
          product_data: { name: `Certify ${plan.name}` },
          unit_amount: Math.round(amount * 100), // cents
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: { org_id: org.id, plan_slug: plan.slug, interval },
    },
    metadata: { org_id: org.id, plan_slug: plan.slug, interval },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  });

  return { id: session.id, redirect_url: session.url, customer_id: customerId };
}

/**
 * Cancel a Stripe subscription (at period end or immediately).
 */
export async function cancelSubscription(stripeSubscriptionId, atPeriodEnd = true) {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  if (atPeriodEnd) {
    return stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
  }
  return stripe.subscriptions.cancel(stripeSubscriptionId);
}

/**
 * Verify and construct a Stripe webhook event.
 */
export function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return stripe.webhooks.constructEvent(rawBody, signature, stripeConfig().webhookSecret);
}

export function isConfigured() {
  return isGatewayAvailable("stripe");
}
