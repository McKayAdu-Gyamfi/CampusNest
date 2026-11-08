import { Router } from "express";
import { cq } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";

const router = Router();

// GET /api/audit?limit=100   newest first; admin only
router.get("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "100"), 10) || 100, 1), 500);
    res.json({ success: true, data: await cq(api.auditLogs.list, { limit }) });
  } catch (err) {
    next(err);
  }
});

export default router;
