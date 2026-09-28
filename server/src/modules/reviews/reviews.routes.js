import { Router } from "express";
import * as controllers from "./reviews.controller.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { createReviewSchema } from "./reviews.schema.js";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/", controllers.getReviews);
router.post("/", requireAuth, requireRole("STUDENT"), validateRequest(createReviewSchema), controllers.createReview);

export default router;
