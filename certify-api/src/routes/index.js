import { Router } from "express";
import { showVerification, trackEvent } from "../controllers/verificationController.js";
import { registerHandler, loginHandler, meHandler } from "../controllers/authController.js";
import {
  listCertificates,
  createCertificate,
  getCertificate,
  revokeCertificate,
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
  changePlan,
} from "../controllers/billingController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadFile } from "../middleware/upload.js";

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

apiRouter.get("/templates", requireAuth, listTemplates);
apiRouter.post("/templates", requireAuth, createTemplate);
apiRouter.get("/templates/:id", requireAuth, getTemplate);
apiRouter.put("/templates/:id", requireAuth, updateTemplate);
apiRouter.delete("/templates/:id", requireAuth, deleteTemplate);

apiRouter.get("/billing", requireAuth, getBilling);
apiRouter.post("/billing/plan", requireAuth, changePlan);

apiRouter.get("/batches", requireAuth, listBatches);
apiRouter.post("/batches", requireAuth, (req, res, next) => {
  uploadFile(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, createBatch);
apiRouter.get("/batches/:id", requireAuth, getBatch);
