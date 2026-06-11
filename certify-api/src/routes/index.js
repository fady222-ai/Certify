import { Router } from "express";
import { showVerification } from "../controllers/verificationController.js";
import { registerHandler, loginHandler, meHandler } from "../controllers/authController.js";
import {
  listCertificates,
  createCertificate,
  dashboardStats,
} from "../controllers/certificateController.js";
import { requireAuth } from "../middleware/auth.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ status: "ok" }));

// --- Public ---
apiRouter.get("/verify/:code", showVerification);
apiRouter.post("/auth/register", registerHandler);
apiRouter.post("/auth/login", loginHandler);

// --- Protected ---
apiRouter.get("/auth/me", requireAuth, meHandler);
apiRouter.get("/me/stats", requireAuth, dashboardStats);
apiRouter.get("/certificates", requireAuth, listCertificates);
apiRouter.post("/certificates", requireAuth, createCertificate);
