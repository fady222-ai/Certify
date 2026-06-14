import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { config } from "./config/index.js";
import { apiRouter } from "./routes/index.js";
import { ensureAdmin } from "./services/ensureAdmin.js";
import { startRenewalJob } from "./jobs/renewSubscriptions.js";
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
app.use("/api/auth/register", registerLimiter);
app.use("/api/auth/forgot-password", sensitiveAuthLimiter);
app.use("/api/auth/resend-otp", sensitiveAuthLimiter);
// Blunt OTP brute-force: cap verification attempts per IP (complements the
// per-code attempt counter enforced in authService.verifyEmail).
app.use("/api/auth/verify-email", sensitiveAuthLimiter);

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
  startRenewalJob();
});
