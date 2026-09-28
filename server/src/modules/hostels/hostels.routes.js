import { Router } from "express";
import * as controllers from "./hostels.controller.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { createHostelSchema, updateHostelSchema, updateHostelStatusSchema } from "./hostels.schema.js";
import { updateAmenitiesSchema, addAmenitySchema } from "../amenities/Amenities.schema.js";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { verifyHostelOwnership } from "../../middlewares/verifyOwnership.js";
import { uploadMiddleware } from "../../middlewares/upload.middleware.js";

const router = Router();

router.get("/", controllers.getHostels);
router.get("/:id", controllers.getHostelById);

// Optionally, you might attach authentication middlewares here in the future
router.post("/", requireAuth, requireRole("HOSTEL_MANAGER"), validateRequest(createHostelSchema), controllers.createHostel);
router.patch("/:id", requireAuth, verifyHostelOwnership, validateRequest(updateHostelSchema), controllers.updateHostel);
router.patch("/:id/status", requireAuth, requireRole("ADMIN"), validateRequest(updateHostelStatusSchema), controllers.updateHostelStatus);

// Amenities routes
router.put("/:id/amenities", requireAuth, verifyHostelOwnership, validateRequest(updateAmenitiesSchema), controllers.updateHostelAmenities);
router.post("/:id/amenities", requireAuth, verifyHostelOwnership, validateRequest(addAmenitySchema), controllers.addHostelAmenity);
router.delete("/:id/amenities/:amenityId", requireAuth, verifyHostelOwnership, controllers.removeHostelAmenity);

// Image upload route
router.post("/:id/images", requireAuth, verifyHostelOwnership, uploadMiddleware.array("images", 10), controllers.uploadHostelImages);

export default router;
