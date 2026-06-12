import dotenv from "dotenv";

dotenv.config();

const DEFAULT_APP_KEY = "dev-insecure-key-change-me";
const appKey = process.env.APP_KEY ?? DEFAULT_APP_KEY;

// In production the signing key protects both JWT auth and the certificate
// tamper-evidence HMAC. A missing/default/weak key would let anyone forge
// tokens and "verified" certificates — refuse to boot rather than run insecure.
if (process.env.NODE_ENV === "production") {
  if (!process.env.APP_KEY || appKey === DEFAULT_APP_KEY) {
    throw new Error(
      "APP_KEY is required in production. Set a strong random secret (32+ chars).",
    );
  }
  if (appKey.length < 32) {
    throw new Error("APP_KEY is too weak in production; use at least 32 characters.");
  }
}

export const config = {
  isProduction: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT ?? "8000", 10),
  appUrl: process.env.APP_URL ?? "http://localhost:8000",

  // Public base URL used to build certificate verification links.
  verifyBaseUrl:
    process.env.CERTIFY_VERIFY_BASE_URL ??
    process.env.WEB_URL ??
    "http://localhost:3000",

  // Secret key for the tamper-evidence HMAC (validated above for production).
  appKey,

  // CORS allowed origins for the web frontend.
  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS ??
    "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((s) => s.trim()),

  // Headless Chrome (puppeteer) — leave empty to use puppeteer's bundled Chrome.
  chromePath: process.env.CERTIFY_CHROME_PATH || undefined,

  // Where generated PDFs are stored on disk (served at /storage).
  storageDir: process.env.CERTIFY_STORAGE_DIR ?? "storage",

  // Super-admin account — provisioned automatically on startup from these vars.
  // The account always has role="admin"; its password is whatever you set here.
  adminEmail: (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  adminName: (process.env.ADMIN_NAME ?? "مدير المنصة").trim(),

  // Email — uses Resend when RESEND_API_KEY is set, otherwise logs to console.
  email: {
    resendApiKey: process.env.RESEND_API_KEY || null,
    from: process.env.EMAIL_FROM ?? "Certify <onboarding@resend.dev>",
    // Set to "false" to disable sending entirely.
    enabled: (process.env.EMAIL_ENABLED ?? "true") !== "false",
  },

  // Stripe — leave empty in dev to skip real charges.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",

  // Tap Payments — leave empty in dev to skip real charges.
  tapSecretKey: process.env.TAP_SECRET_KEY ?? "",
  tapWebhookSecret: process.env.TAP_WEBHOOK_SECRET ?? "",

  // Paymob (Egypt — Vodafone Cash, InstaPay, Fawry, Meeza, cards) — leave empty in dev.
  paymobApiKey: process.env.PAYMOB_API_KEY ?? "",
  paymobIntegrationId: process.env.PAYMOB_INTEGRATION_ID ?? "",
  paymobIframeId: process.env.PAYMOB_IFRAME_ID ?? "",
  paymobHmacSecret: process.env.PAYMOB_HMAC_SECRET ?? "",
  // Conversion rate USD→EGP used when charging via Paymob (update when rate changes).
  paymobEgpRate: parseFloat(process.env.PAYMOB_USD_TO_EGP_RATE ?? "50.5"),
};
