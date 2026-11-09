import { Router } from "express";
import express from "express";
import * as controllers from "./auth.controller.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { registerManagerSchema } from "./auth.schema.js";
import { minResponseTime, PASSWORD_RESET_MIN_MS } from "../../middlewares/minResponseTime.middleware.js";
import { signInLimiter, registrationLimiter, passwordResetLimiter, passwordResetConfirmLimiter } from "../../middlewares/rateLimit.middleware.js";

const router = Router();
const jsonParser = express.json();

// Custom route for MANAGER signup
router.post(
  "/register",
  registrationLimiter,
  jsonParser,
  validateRequest(registerManagerSchema),
  controllers.registerManager
);

// Standard explicit Auth endpoints mapped manually
router.post("/sign-up/email", registrationLimiter, jsonParser, controllers.signUp);
router.post("/sign-in/email", signInLimiter, jsonParser, controllers.signIn);
router.post("/sign-out", jsonParser, controllers.signOut);

// Better Auth serves these two; the limiter runs first, then the request falls
// through to its handler untouched (no body parser here, so the stream is intact).
router.post("/request-password-reset", passwordResetLimiter, minResponseTime(PASSWORD_RESET_MIN_MS));
router.post("/reset-password", passwordResetConfirmLimiter);

export default router;
