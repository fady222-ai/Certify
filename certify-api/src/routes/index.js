import express, { Router } from "express";
import { showVerification, trackEvent } from "../controllers/verificationController.js";
import {
  registerHandler,
  verifyEmailHandler,
  resendOtpHandler,
  loginHandler,
  logoutHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  meHandler,
  mfaVerifyHandler,
  mfaSetupHandler,
  mfaEnableHandler,
  mfaDisableHandler,
} from "../controllers/authController.js";
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
  cancelSubscription,
  changePlan,
} from "../controllers/billingController.js";
import {
  handleCallback,
  handleTapWebhook,
  handleStripeWebhook,
  handlePaymobCallback,
  handlePaymobWebhook,
} from "../controllers/billingWebhookController.js";
import {
  getOrganization,
  updateOrganization,
  setDefaultTemplate,
  uploadBranding,
  deleteBranding,
} from "../controllers/organizationController.js";
import {
  getAdminStats,
  listAdminOrganizations,
  getAdminOrganization,
  adminChangePlan,
  adminToggleSuspend,
  listPaymentGateways,
  updatePaymentGateway,
  deletePaymentGateway,
} from "../controllers/adminController.js";
import {
  createTicket,
  listMyTickets,
  getMyTicket,
  replyTicket,
  closeTicket,
  createGuestTicket,
  getGuestTicket,
  replyGuestTicket,
  adminListTickets,
  adminGetTicket,
  adminReplyTicket,
  adminSetStatus,
} from "../controllers/supportController.js";
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
apiRouter.post("/auth/verify-email", verifyEmailHandler);
apiRouter.post("/auth/resend-otp", resendOtpHandler);
apiRouter.post("/auth/login", loginHandler);
apiRouter.post("/auth/forgot-password", forgotPasswordHandler);
apiRouter.post("/auth/reset-password", resetPasswordHandler);
apiRouter.post("/auth/mfa/verify", mfaVerifyHandler); // step 2 of login (public)

// Support — public guest flow (token capability, no auth)
apiRouter.post("/support/public/tickets", createGuestTicket);
apiRouter.get("/support/public/tickets/:token", getGuestTicket);
apiRouter.post("/support/public/tickets/:token/messages", replyGuestTicket);

// --- Protected ---
apiRouter.get("/auth/me", requireAuth, meHandler);
apiRouter.post("/auth/logout", requireAuth, logoutHandler);
apiRouter.post("/auth/mfa/setup", requireAuth, mfaSetupHandler);
apiRouter.post("/auth/mfa/enable", requireAuth, mfaEnableHandler);
apiRouter.post("/auth/mfa/disable", requireAuth, mfaDisableHandler);
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
apiRouter.get("/billing/paymob/callback", handlePaymobCallback);
apiRouter.post("/billing/paymob/webhook", handlePaymobWebhook);
apiRouter.post("/billing/cancel", requireAuth, cancelSubscription);
apiRouter.post("/billing/plan", requireAuth, changePlan);

apiRouter.get("/organization", requireAuth, getOrganization);
apiRouter.patch("/organization", requireAuth, updateOrganization);
apiRouter.put("/organization/default-template", requireAuth, setDefaultTemplate);
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

// Support — authenticated user flow
apiRouter.post("/support/tickets", requireAuth, createTicket);
apiRouter.get("/support/tickets", requireAuth, listMyTickets);
apiRouter.get("/support/tickets/:id", requireAuth, getMyTicket);
apiRouter.post("/support/tickets/:id/messages", requireAuth, replyTicket);
apiRouter.post("/support/tickets/:id/close", requireAuth, closeTicket);

// --- Admin (platform owner only) ---
apiRouter.get("/admin/stats", requireAuth, requireAdmin, getAdminStats);
apiRouter.get("/admin/organizations", requireAuth, requireAdmin, listAdminOrganizations);
apiRouter.get("/admin/organizations/:id", requireAuth, requireAdmin, getAdminOrganization);
apiRouter.patch("/admin/organizations/:id/plan", requireAuth, requireAdmin, adminChangePlan);
apiRouter.patch("/admin/organizations/:id/suspend", requireAuth, requireAdmin, adminToggleSuspend);
apiRouter.get("/admin/payment-gateways", requireAuth, requireAdmin, listPaymentGateways);
apiRouter.put("/admin/payment-gateways/:gateway", requireAuth, requireAdmin, updatePaymentGateway);
apiRouter.delete("/admin/payment-gateways/:gateway", requireAuth, requireAdmin, deletePaymentGateway);

// Support — admin queue
apiRouter.get("/support/admin/tickets", requireAuth, requireAdmin, adminListTickets);
apiRouter.get("/support/admin/tickets/:id", requireAuth, requireAdmin, adminGetTicket);
apiRouter.post("/support/admin/tickets/:id/messages", requireAuth, requireAdmin, adminReplyTicket);
apiRouter.patch("/support/admin/tickets/:id/status", requireAuth, requireAdmin, adminSetStatus);
