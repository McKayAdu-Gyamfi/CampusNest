import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";

// GET /api/settings/public — what any visitor may know: the brand name and
// whether bookings are paused. The support email and timestamps stay admin-only.
export const getPublicSettings = async (req, res, next) => {
  try {
    const s = await cq(api.settings.get, {});
    res.json({ success: true, data: { platform_name: s.platform_name, maintenance_mode: s.maintenance_mode } });
  } catch (err) {
    next(err);
  }
};

export const getSettings = async (req, res, next) => {
  try {
    res.json({ success: true, data: await cq(api.settings.get, {}) });
  } catch (err) {
    next(err);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    res.json({ success: true, data: await cm(api.settings.update, req.body) });
  } catch (err) {
    next(err);
  }
};
