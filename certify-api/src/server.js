import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { config } from "./config/index.js";
import { apiRouter } from "./routes/index.js";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.set("trust proxy", 1);

// Serve generated certificate PDFs.
app.use("/storage", express.static(path.resolve(config.storageDir)));

// Rate-limit the API surface.
app.use(
  "/api",
  rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }),
);

// Stricter limiter on credential endpoints to blunt brute-force / credential
// stuffing (login + register). 10 attempts per IP per minute.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "محاولات كثيرة جداً. يرجى المحاولة بعد قليل." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use("/api", apiRouter);

// 404 + error handlers
app.use((req, res) => res.status(404).json({ message: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.statusCode ?? 500;
  // Never leak internal error details to clients on 5xx — log server-side only.
  if (status >= 500) {
    console.error(err);
    return res.status(status).json({ message: "حدث خطأ في الخادم." });
  }
  res.status(status).json({ message: err.message ?? "Server error" });
});

// Keep the server alive if an async dependency (e.g. headless Chrome) emits an
// error outside a request's try/catch; log it instead of crashing the process.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Certify API listening on http://0.0.0.0:${config.port}`);
});
