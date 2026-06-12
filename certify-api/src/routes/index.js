import express, { Router } from "express";
import { showVerification, trackEvent } from "../controllers/verificationController.js";
import { registerHandler, loginHandler, meHandler } from "../controllers/authController.js";
import {
  listCertificates,
  createCertificate,
  getCertificate,
  revokeCertificate,
  resendCertificateEmail,
  dashboardStats,
} from "../controllers/certificateController.js";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "../controllers/templateController.js";
import {
  createBatch,
  listBatches,
  getBatch,
} from "../controllers/batchController.js";
import {
  listPlans,
  getBilling,
  createCheckout,
  handleCallback,
  handleTapWebhook,
  handleStripeWebhook,
  cancelSubscription,
  changePlan,
} from "../controllers/billingController.js";
import {
  getOrganization,
  updateOrganization,
  uploadBranding,
  deleteBranding,
} from "../controllers/organizationController.js";
import {
  getAdminStats,
  listAdminOrganizations,
  adminChangePlan,
  adminToggleSuspend,
} from "../controllers/adminController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { uploadFile } from "../middleware/upload.js";
import { uploadImage } from "../middleware/uploadImage.js";

// Raw-body capture middleware (used for webhook signature verification)
const captureRawBody = [
  express.raw({ type: "*/*" }),
  (req, _res, next) => {
    if (Buffer.isBuffer(req.body)) req.rawBody = req.body.toString("utf8");
    next();
  },
];

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ status: "ok" }));

// --- Public ---
apiRouter.get("/verify/:code", showVerification);
apiRouter.post("/verify/:code/track", trackEvent);
apiRouter.get("/plans", listPlans);
apiRouter.post("/auth/register", registerHandler);
apiRouter.post("/auth/login", loginHandler);

// --- Protected ---
apiRouter.get("/auth/me", requireAuth, meHandler);
apiRouter.get("/me/stats", requireAuth, dashboardStats);
apiRouter.get("/certificates", requireAuth, listCertificates);
apiRouter.post("/certificates", requireAuth, createCertificate);
apiRouter.get("/certificates/:id", requireAuth, getCertificate);
apiRouter.post("/certificates/:id/revoke", requireAuth, revokeCertificate);
apiRouter.post("/certificates/:id/resend-email", requireAuth, resendCertificateEmail);

apiRouter.get("/templates", requireAuth, listTemplates);
apiRouter.post("/templates", requireAuth, createTemplate);
apiRouter.get("/templates/:id", requireAuth, getTemplate);
apiRouter.put("/templates/:id", requireAuth, updateTemplate);
apiRouter.delete("/templates/:id", requireAuth, deleteTemplate);

// Billing
apiRouter.get("/billing", requireAuth, getBilling);
apiRouter.post("/billing/checkout", requireAuth, createCheckout);
apiRouter.get("/billing/callback", handleCallback);
apiRouter.post("/billing/webhook", ...captureRawBody, handleTapWebhook);
apiRouter.post("/billing/stripe/webhook", ...captureRawBody, handleStripeWebhook);
apiRouter.post("/billing/cancel", requireAuth, cancelSubscription);
apiRouter.post("/billing/plan", requireAuth, changePlan);

apiRouter.get("/organization", requireAuth, getOrganization);
apiRouter.patch("/organization", requireAuth, updateOrganization);
apiRouter.post("/organization/branding/:kind", requireAuth, (req, res, next) => {
  uploadImage(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, uploadBranding);
apiRouter.delete("/organization/branding/:kind", requireAuth, deleteBranding);

apiRouter.get("/batches", requireAuth, listBatches);
apiRouter.post("/batches", requireAuth, (req, res, next) => {
  uploadFile(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, createBatch);
apiRouter.get("/batches/:id", requireAuth, getBatch);

// --- Admin (platform owner only) ---
apiRouter.get("/admin/stats", requireAuth, requireAdmin, getAdminStats);
apiRouter.get("/admin/organizations", requireAuth, requireAdmin, listAdminOrganizations);
apiRouter.patch("/admin/organizations/:id/plan", requireAuth, requireAdmin, adminChangePlan);
apiRouter.patch("/admin/organizations/:id/suspend", requireAuth, requireAdmin, adminToggleSuspend);
