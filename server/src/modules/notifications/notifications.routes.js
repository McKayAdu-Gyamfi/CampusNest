import { Router } from "express";
import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";

const router = Router();

// GET /api/notifications — the signed-in user's own notifications, newest first.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const data = await cq(api.notifications.listForUser, { userId: req.user.id, limit: 50 });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
router.post("/read-all", requireAuth, async (req, res, next) => {
  try {
    const count = await cm(api.notifications.markAllRead, { userId: req.user.id });
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const ok = await cm(api.notifications.markRead, { id: req.params.id, userId: req.user.id });
    if (!ok) return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
