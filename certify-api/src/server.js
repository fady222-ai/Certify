import "./instrument.js"; // initialize Sentry first (no-op unless SENTRY_DSN set)
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import path from "node:path";
import { config } from "./config/index.js";
import { apiRouter } from "./routes/index.js";
import { ensureAdmin } from "./services/ensureAdmin.js";
import { ensureOrgNameIndex } from "./services/ensureOrgNameIndex.js";
import { startRenewalJob } from "./jobs/renewSubscriptions.js";
import { loadGatewayConfigs } from "./services/gatewayConfig.js";
import { loadPlatformSettings } from "./services/platformSettings.js";
import { loadWhatsappConfigs } from "./services/whatsappConfig.js";
import { reportError } from "./services/errorReporter.js";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
);
// Skip JSON parsing on webhook endpoints — they need raw body for signature verification.
app.use((req, res, next) => {
  const url = req.originalUrl ?? "";
  if (url.includes("/billing/webhook") || url.includes("/billing/stripe/webhook")) return next();
  express.json({ limit: "2mb" })(req, res, next);
});
app.set("trust proxy", 1);

// Serve generated certificate PDFs + uploaded images. Defense in depth: force
// nosniff so a stored file can never be content-sniffed into an executable type
// (uploads are already restricted to png/jpg/webp with server-generated names).
app.use("/storage", express.static(path.resolve(config.storageDir), {
  setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
}));

// Rate-limit the API surface.
app.use(
  "/api",
  rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }),
);

// Stricter limiters on auth endpoints to blunt brute-force / credential stuffing.
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل." },
});
// يَعُدّ المحاولات الفاشلة فقط لكل IP — يحظر المهاجم دون إقفال حساب الضحية.
// يحلّ محلّ قفل الحساب لكل‑مستخدم الذي كان قابلاً للتسليح عبر المعرّف العام.
const loginFailureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "محاولات دخول فاشلة كثيرة. حاول مجدداً بعد قليل." },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل." },
});
const sensitiveAuthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل." },
});
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/login", loginFailureLimiter);
// MFA second step — cap TOTP/backup-code guessing per IP (the 6-digit space is
// small, so this matters even behind the challenge token).
app.use("/api/auth/mfa/verify", loginLimiter);
app.use("/api/auth/mfa/verify", loginFailureLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/auth/forgot-password", sensitiveAuthLimiter);
app.use("/api/auth/resend-otp", sensitiveAuthLimiter);
// Blunt OTP brute-force: cap verification attempts per IP (complements the
// per-code attempt counter enforced in authService.verifyEmail).
app.use("/api/auth/verify-email", sensitiveAuthLimiter);

// Dedicated cap on the public, unauthenticated billing webhook/callback routes.
// Forged webhooks are cheap to reject (signature check), but this bounds a flood
// independently of the general /api budget. 60/min/IP comfortably covers real
// gateway traffic (Stripe/Tap/Paymob send events at low rate, even with retries).
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests." },
});
app.use("/api/billing/webhook", webhookLimiter); // Tap
app.use("/api/billing/stripe/webhook", webhookLimiter); // Stripe
app.use("/api/billing/paymob/webhook", webhookLimiter); // Paymob (POST)
app.use("/api/billing/paymob/callback", webhookLimiter); // Paymob (GET redirect)

// Authenticated checkout: each call may create a gateway session/charge, so cap
// per IP to blunt abuse/automated probing on top of the general /api budget.
app.use("/api/billing/checkout", rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل." },
}));

// Public, unauthenticated certificate-verification routes — bound per IP on top
// of the general /api budget (codes have ~80 bits entropy, so this is depth).
app.use("/api/verify", rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل." },
}));

// Public developer API (/api/v1) — keyed per API key (hash of the Bearer token)
// so one org's quota can't be exhausted by another, falling back to IP.
app.use("/api/v1", rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const h = req.get("authorization") ?? "";
    return h.startsWith("Bearer ")
      ? crypto.createHash("sha256").update(h.slice(7).trim()).digest("hex")
      : req.ip;
  },
  message: { error: "rate_limited", message: "Rate limit exceeded (300 requests/minute)." },
}));

// Public, unauthenticated support endpoints (guest ticket create + token access).
// The publicToken is a UUID capability (~122 bits), so this is depth-in-defense:
// it bounds token-guessing and guest-email spam on top of the general /api budget.
app.use("/api/support/public", rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل." },
}));
// Tighter cap specifically on guest ticket CREATION (POST exact path) to blunt
// mass email spam, without throttling token reads/replies under the same prefix.
app.post("/api/support/public/tickets", rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "لقد أرسلت طلبات كثيرة. حاول لاحقاً." },
}));
// Authenticated ticket CREATION (POST exact path). The per-requester open-ticket
// cap bounds outstanding tickets; this caps churn (create+close cycling) per IP
// so new-ticket admin emails / DB rows can't be spammed.
// Trainee wallet: a general read cap on the prefix, plus a tight per-IP cap on
// the magic-link request (POST) so it can't be used to mass-email addresses.
app.use("/api/wallet", rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل." },
}));
app.post("/api/wallet/request", rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "لقد أرسلت طلبات كثيرة. حاول لاحقاً." },
}));
app.post("/api/support/tickets", rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل." },
}));

app.use("/api", apiRouter);

// 404 + error handlers
app.use((req, res) => res.status(404).json({ message: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.statusCode ?? 500;
  // Never leak internal error details to clients on 5xx — log/alert server-side.
  if (status >= 500) {
    reportError(err, { where: "request", method: req.method, path: req.originalUrl });
    return res.status(status).json({ message: "حدث خطأ في الخادم." });
  }
  res.status(status).json({ message: err.message ?? "Server error" });
});

// Keep the server alive if an async dependency (e.g. headless Chrome) emits an
// error outside a request's try/catch; log/alert instead of crashing.
process.on("unhandledRejection", (reason) => {
  reportError(reason, { where: "unhandledRejection" });
});
process.on("uncaughtException", (err) => {
  reportError(err, { where: "uncaughtException" });
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Certify API listening on http://0.0.0.0:${config.port}`);
  // Provision the super-admin from env (idempotent, best-effort).
  ensureAdmin().catch((e) => console.error("[admin] provisioning failed:", e.message));
  // Enforce unique academy name at the DB level (idempotent, fault-tolerant).
  ensureOrgNameIndex().catch((e) => console.error("[orgindex]", e.message));
  // Load admin-set payment gateway credentials into memory (falls back to env).
  loadGatewayConfigs().catch((e) => console.error("[gatewayConfig]", e.message));
  // Load the platform WhatsApp flag + per-org WhatsApp credentials into memory.
  loadPlatformSettings().catch((e) => console.error("[platformSettings]", e.message));
  loadWhatsappConfigs().catch((e) => console.error("[whatsappConfig]", e.message));
  startRenewalJob();
});
