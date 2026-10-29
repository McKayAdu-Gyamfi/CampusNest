import { Router } from "express";
import * as controllers from "./settings.controller.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { updateSettingsSchema } from "./settings.schema.js";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/public", controllers.getPublicSettings);
router.get("/", requireAuth, requireRole("ADMIN"), controllers.getSettings);
router.patch("/", requireAuth, requireRole("ADMIN"), validateRequest(updateSettingsSchema), controllers.updateSettings);

export default router;
