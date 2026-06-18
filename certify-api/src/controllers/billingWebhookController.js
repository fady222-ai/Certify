// Gateway-facing billing endpoints: redirect callbacks and signed webhooks for
// Tap, Paymob and Stripe. These verify signatures, dedupe replays, and apply the
// resulting subscription state change via the shared billing service. Split out
// of billingController.js (which keeps the authenticated checkout/management
// handlers) to keep each file focused.
import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";
import { constructWebhookEvent } from "../services/stripeService.js";
import { retrieveCharge, verifyWebhookSignature } from "../services/tapService.js";
import { verifyHmac as paymobVerifyHmac } from "../services/paymobService.js";
import { sendPaymentReceipt } from "../services/billingMailer.js";
import { logMailFailure } from "../services/email/index.js";
import { applyPlanToOrg, isFreshWebhookEvent } from "../services/billingService.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/billing/callback  (Tap redirect)
// ─────────────────────────────────────────────────────────────────────────────

export async function handleCallback(req, res) {
  const tapId = req.query?.tap_id ?? req.query?.id;
  const webUrl = config.verifyBaseUrl;

  if (!tapId) return res.redirect(`${webUrl}/dashboard/billing?error=missing_id`);

  try {
    const charge = await retrieveCharge(tapId);
    if (charge.status !== "CAPTURED")
      return res.redirect(`${webUrl}/dashboard/billing?error=payment_failed`);

    const sub = await prisma.subscription.findFirst({
      where: { tapChargeId: tapId },
      include: { plan: true },
    });
    if (!sub) return res.redirect(`${webUrl}/dashboard/billing?error=not_found`);

    await applyPlanToOrg(sub.organizationId, sub.plan, {
      gateway: "tap",
      tapChargeId: tapId,
      tapCustomerId: charge.customer?.id ?? sub.tapCustomerId,
      tapCardId: charge.card?.id ?? sub.tapCardId,
      interval: sub.interval,
      amount: sub.amount ?? 0,
      currency: "USD",
    }, { notify: true });

    return res.redirect(`${webUrl}/dashboard/billing?success=1`);
  } catch (err) {
    console.error("Tap callback error:", err);
    return res.redirect(`${webUrl}/dashboard/billing?error=verify_failed`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/billing/webhook  (Tap — raw body)
// ─────────────────────────────────────────────────────────────────────────────

export async function handleTapWebhook(req, res) {
  const signature = req.headers["hashdigest"] ?? req.headers["x-tap-signature"] ?? "";

  if (!verifyWebhookSignature(req.rawBody ?? "", signature))
    return res.status(401).json({ message: "Invalid signature." });

  let event;
  try { event = JSON.parse(req.rawBody ?? "{}"); } catch { return res.status(400).json({ message: "Invalid JSON." }); }

  const chargeId = event?.id ?? event?.charge?.id;
  const status = event?.status ?? event?.charge?.status;
  if (!chargeId) return res.json({ received: true });

  // Idempotency: don't re-process a replayed charge event (keyed by charge+status
  // so a genuine later transition — e.g. CAPTURED then a refund — still applies).
  if (!(await isFreshWebhookEvent("tap", `${chargeId}:${status}`)))
    return res.json({ received: true });

  try {
    if (status === "CAPTURED") {
      const sub = await prisma.subscription.findFirst({ where: { tapChargeId: chargeId }, include: { plan: true } });
      if (sub && sub.status !== "active") {
        await applyPlanToOrg(sub.organizationId, sub.plan, {
          gateway: "tap",
          tapChargeId: chargeId,
          tapCustomerId: event.customer?.id ?? sub.tapCustomerId,
          tapCardId: event.card?.id ?? sub.tapCardId,
          interval: sub.interval,
          amount: sub.amount ?? 0,
          currency: "USD",
        });
      }
    } else if (["FAILED", "DECLINED", "CANCELLED"].includes(status)) {
      await prisma.subscription.updateMany({ where: { tapChargeId: chargeId }, data: { status: "past_due" } });
    }
  } catch (err) { console.error("Tap webhook error:", err); }

  res.json({ received: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/billing/paymob/callback  (Paymob redirect after payment)
// ─────────────────────────────────────────────────────────────────────────────

export async function handlePaymobCallback(req, res) {
  const webUrl = config.verifyBaseUrl;
  const q = req.query ?? {};

  const success = q.success === "true";
  const pending = q.pending === "true";
  const hmac = q.hmac ?? "";

  // Build params object for HMAC verification (remove hmac itself)
  const { hmac: _h, ...hmacParams } = q;
  if (!paymobVerifyHmac(hmacParams, hmac))
    return res.redirect(`${webUrl}/dashboard/billing?error=verify_failed`);

  if (!success || pending)
    return res.redirect(`${webUrl}/dashboard/billing?error=payment_failed`);

  // Merchant order ID embedded as certify_{orgId}_{ts}
  const merchantOrderId = q.merchant_order_id ?? "";
  const orgId = merchantOrderId.startsWith("certify_") ? merchantOrderId.split("_")[1] : null;
  if (!orgId) return res.redirect(`${webUrl}/dashboard/billing?error=not_found`);

  try {
    const sub = await prisma.subscription.findFirst({
      where: { organizationId: orgId, gateway: "paymob" },
      include: { plan: true },
    });
    if (!sub) return res.redirect(`${webUrl}/dashboard/billing?error=not_found`);

    // `token` query param is the card token for recurring (present for card payments)
    const cardToken = q.token ?? null;

    await applyPlanToOrg(orgId, sub.plan, {
      gateway: "paymob",
      paymobOrderId: sub.paymobOrderId,
      paymobCardToken: cardToken ?? sub.paymobCardToken,
      interval: sub.interval,
      amount: sub.amount ?? 0,
      currency: "USD",
    }, { notify: true });

    return res.redirect(`${webUrl}/dashboard/billing?success=1`);
  } catch (err) {
    console.error("Paymob callback error:", err);
    return res.redirect(`${webUrl}/dashboard/billing?error=verify_failed`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/billing/paymob/webhook  (Paymob transaction notification — JSON)
// ─────────────────────────────────────────────────────────────────────────────

export async function handlePaymobWebhook(req, res) {
  const body = req.body ?? {};
  if (body.type !== "TRANSACTION") return res.json({ received: true });

  const obj = body.obj ?? {};
  const hmac = body.hmac ?? "";

  // Build flat params from obj for HMAC verification
  const hmacParams = {
    amount_cents: obj.amount_cents,
    created_at: obj.created_at,
    currency: obj.currency,
    error_occured: obj.error_occured,
    has_parent_transaction: obj.has_parent_transaction,
    id: obj.id,
    integration_id: obj.integration_id,
    is_3d_secure: obj.is_3d_secure,
    is_auth: obj.is_auth,
    is_capture: obj.is_capture,
    is_refunded: obj.is_refunded,
    is_standalone_payment: obj.is_standalone_payment,
    is_voided: obj.is_voided,
    order: obj.order?.id ?? obj.order,
    owner: obj.owner?.id ?? obj.owner,
    pending: obj.pending,
    "source_data.pan": obj.source_data?.pan,
    "source_data.sub_type": obj.source_data?.sub_type,
    "source_data.type": obj.source_data?.type,
    success: obj.success,
  };

  if (!paymobVerifyHmac(hmacParams, hmac))
    return res.status(401).json({ message: "Invalid HMAC." });

  // Idempotency: Paymob may re-deliver a transaction notification.
  if (!(await isFreshWebhookEvent("paymob", obj.id)))
    return res.json({ received: true });

  const merchantOrderId = obj.order?.merchant_order_id ?? "";
  const orgId = merchantOrderId.startsWith("certify_") ? merchantOrderId.split("_")[1] : null;
  if (!orgId) return res.json({ received: true });

  try {
    const sub = await prisma.subscription.findFirst({
      where: { organizationId: orgId, gateway: "paymob" },
      include: { plan: true },
    });
    if (!sub) return res.json({ received: true });

    if (obj.success === true && obj.pending === false) {
      if (sub.status !== "active") {
        const cardToken = obj.token ?? obj.payment_key_claims?.token ?? null;
        await applyPlanToOrg(orgId, sub.plan, {
          gateway: "paymob",
          paymobOrderId: sub.paymobOrderId,
          paymobCardToken: cardToken ?? sub.paymobCardToken,
          interval: sub.interval,
          amount: sub.amount ?? 0,
          currency: "USD",
        }, { notify: true });
      }
    } else if (obj.success === false && obj.pending === false) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } });
    }
  } catch (err) {
    console.error("Paymob webhook error:", err);
  }

  res.json({ received: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/billing/stripe/webhook  (Stripe — raw body)
// ─────────────────────────────────────────────────────────────────────────────

export async function handleStripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"] ?? "";
  let event;

  try {
    event = constructWebhookEvent(req.rawBody ?? "", sig);
  } catch (err) {
    return res.status(400).json({ message: `Webhook error: ${err.message}` });
  }

  // Stripe re-delivers events on timeout/retry — process each one only once.
  if (!(await isFreshWebhookEvent("stripe", event.id)))
    return res.json({ received: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const { org_id, plan_slug, interval } = session.metadata ?? {};
        if (!org_id || !plan_slug) break;

        const plan = await prisma.plan.findUnique({ where: { slug: plan_slug } });
        if (!plan) break;

        const amount = interval === "annual" ? plan.priceYearly : plan.priceMonthly;

        await applyPlanToOrg(org_id, plan, {
          gateway: "stripe",
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          interval: interval ?? "monthly",
          amount,
          currency: "USD",
        }, { notify: true });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;
        if (!stripeSubId) break;

        const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: stripeSubId } });
        if (!sub) break;

        // Extend period by one billing cycle
        const now = new Date();
        const next = new Date(now);
        if (sub.interval === "annual") next.setFullYear(next.getFullYear() + 1);
        else next.setMonth(next.getMonth() + 1);

        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "active", currentPeriodStart: now, currentPeriodEnd: next },
        });

        // Fire renewal receipt email (best-effort)
        const renewedPlan = await prisma.plan.findUnique({ where: { id: sub.planId } });
        if (renewedPlan) {
          sendPaymentReceipt(sub.organizationId, renewedPlan, { ...sub, currentPeriodEnd: next }, { isRenewal: true }).catch(logMailFailure(`renewal receipt for sub ${sub.id}`));
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;
        if (stripeSubId) {
          await prisma.subscription.updateMany({ where: { stripeSubscriptionId: stripeSubId }, data: { status: "past_due" } });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const stripeSub = event.data.object;
        const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: stripeSub.id } });
        if (!sub) break;

        const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });
        if (freePlan) {
          await prisma.$transaction([
            prisma.organization.update({ where: { id: sub.organizationId }, data: { planId: freePlan.id } }),
            prisma.subscription.update({ where: { id: sub.id }, data: { status: "cancelled", planId: freePlan.id, cancelledAt: new Date() } }),
          ]);
        }
        break;
      }

      case "customer.subscription.updated": {
        const stripeSub = event.data.object;
        if (stripeSub.cancel_at_period_end) {
          await prisma.subscription.updateMany({ where: { stripeSubscriptionId: stripeSub.id }, data: { cancelAtPeriodEnd: true } });
        }
        break;
      }
    }
  } catch (err) {
    console.error("Stripe webhook processing error:", err);
  }

  res.json({ received: true });
}
