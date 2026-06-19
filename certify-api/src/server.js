import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { config } from "./config/index.js";
import { apiRouter } from "./routes/index.js";
import { ensureAdmin } from "./services/ensureAdmin.js";
import { ensureOrgNameIndex } from "./services/ensureOrgNameIndex.js";
import { startRenewalJob } from "./jobs/renewSubscriptions.js";
import { loadGatewayConfigs } from "./services/gatewayConfig.js";
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

// Serve generated certificate PDFs.
app.use("/storage", express.static(path.resolve(config.storageDir)));

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
  startRenewalJob();
});
