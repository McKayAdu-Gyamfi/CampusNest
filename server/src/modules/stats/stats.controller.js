import { cq } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";

// Scoped to the signed-in manager; no manager id is ever taken from the request.
export const getManagerStats = async (req, res, next) => {
  try {
    res.json({ success: true, data: await cq(api.stats.managerOverview, { managerId: req.user.id }) });
  } catch (err) {
    next(err);
  }
};

export const getAdminStats = async (req, res, next) => {
  try {
    res.json({ success: true, data: await cq(api.stats.adminOverview, {}) });
  } catch (err) {
    next(err);
  }
};
