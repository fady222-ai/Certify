import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? "8000", 10),
  appUrl: process.env.APP_URL ?? "http://localhost:8000",

  // Public base URL used to build certificate verification links.
  verifyBaseUrl:
    process.env.CERTIFY_VERIFY_BASE_URL ??
    process.env.WEB_URL ??
    "http://localhost:3000",

  // Secret key for the tamper-evidence HMAC (set a strong value in prod).
  appKey: process.env.APP_KEY ?? "dev-insecure-key-change-me",

  // CORS allowed origins for the web frontend.
  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS ??
    "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((s) => s.trim()),

  // Headless Chrome (puppeteer) — leave empty to use puppeteer's bundled Chrome.
  chromePath: process.env.CERTIFY_CHROME_PATH || undefined,

  // Where generated PDFs are stored on disk (served at /storage).
  storageDir: process.env.CERTIFY_STORAGE_DIR ?? "storage",

  // Email — uses Resend when RESEND_API_KEY is set, otherwise logs to console.
  email: {
    resendApiKey: process.env.RESEND_API_KEY || null,
    from: process.env.EMAIL_FROM ?? "Certify <onboarding@resend.dev>",
    // Set to "false" to disable sending entirely.
    enabled: (process.env.EMAIL_ENABLED ?? "true") !== "false",
  },
};
