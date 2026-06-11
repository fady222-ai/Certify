import { Router } from "express";
import { showVerification } from "../controllers/verificationController.js";

export const apiRouter = Router();

// Public certificate verification (network-effect surface — no auth).
apiRouter.get("/verify/:code", showVerification);

apiRouter.get("/health", (_req, res) => res.json({ status: "ok" }));
