import { Router } from "express";
import * as controllers from "./schools.controller.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { createSchoolSchema, updateSchoolSchema, assignHostelSchema } from "./schools.schema.js";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";

const router = Router();
const admin = [requireAuth, requireRole("ADMIN")];

router.get("/", ...admin, controllers.listSchools);
router.post("/", ...admin, validateRequest(createSchoolSchema), controllers.createSchool);
router.get("/unassigned-hostels", ...admin, controllers.listUnassignedHostels);
router.patch("/:id", ...admin, validateRequest(updateSchoolSchema), controllers.updateSchool);
router.get("/:id/hostels", ...admin, controllers.listSchoolHostels);
router.post("/:id/hostels", ...admin, validateRequest(assignHostelSchema), controllers.assignHostel);
router.delete("/:id/hostels/:hostelId", ...admin, controllers.unassignHostel);

export default router;
