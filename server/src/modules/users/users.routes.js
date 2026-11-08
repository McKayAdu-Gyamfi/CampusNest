import { Router } from "express";
import * as controllers from "./users.controller.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { 
  updateUserProfileSchema, 
  completeProfileSchema, 
  adminUpdateUserSchema,
  createAdminSchema,
  completeManagerProfileSchema,
  setSuspensionSchema
} from "./users.schema.js";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";

const router = Router();

// COMMON ROUTE (Anyone logged in)
router.get("/me", requireAuth, controllers.getMe);
router.patch("/me", requireAuth, validateRequest(updateUserProfileSchema), controllers.updateMe);

// STUDENT-ONLY ROUTE
router.patch(
  "/me/profile-complete",
  requireAuth,
  requireRole("STUDENT"),
  validateRequest(completeProfileSchema),
  controllers.completeProfile
);

// MANAGER-ONLY ROUTE
router.patch(
  "/me/manager-profile-complete",
  requireAuth,
  requireRole("HOSTEL_MANAGER"),
  validateRequest(completeManagerProfileSchema),
  controllers.completeManagerProfile
);

router.get(
  "/me/hostels",
  requireAuth,
  requireRole("HOSTEL_MANAGER"),
  controllers.getMyHostels
);

// ADMIN-ONLY ROUTES
router.get(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  controllers.listUsers
);

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  validateRequest(createAdminSchema),
  controllers.createAdmin
);

router.get("/:id/detail", requireAuth, requireRole("ADMIN"), controllers.getUserDetail);

router.patch(
  "/:id/suspension",
  requireAuth,
  requireRole("ADMIN"),
  validateRequest(setSuspensionSchema),
  controllers.setUserSuspension
);

router.get(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  controllers.getUserById
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validateRequest(adminUpdateUserSchema),
  controllers.adminUpdateUser
);

export default router;
