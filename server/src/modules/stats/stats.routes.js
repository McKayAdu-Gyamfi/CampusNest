import { Router } from "express";
import * as controllers from "./stats.controller.js";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/manager", requireAuth, requireRole("HOSTEL_MANAGER"), controllers.getManagerStats);
router.get("/admin", requireAuth, requireRole("ADMIN"), controllers.getAdminStats);

export default router;
