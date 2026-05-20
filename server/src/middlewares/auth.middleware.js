import { auth } from "../../auth.js";
import { convex } from "../config/db.js";

export const requireAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.user) {
      console.error("[Auth Middleware - requireAuth] Error: Unauthorized (no session)");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    console.log("[Auth Middleware - requireAuth] Success for user:", session.user.id);
    req.user = session.user;
    next();
  } catch (error) {
    console.error("[Auth Middleware - requireAuth] Catch Error:", error);
    next(error);
  }
};

export const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Strict matching per requirements:
    if (req.user.user_type !== role) {
      console.error(`[Auth Middleware - requireRole] Error: User type ${req.user.user_type} does not match required role ${role}`);
      return res.status(403).json({ success: false, message: "Forbidden: insufficient permissions" });
    }
    console.log(`[Auth Middleware - requireRole] Success: Role ${role} authorized`);
    next();
  };
};

export const requireCompleteProfile = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await convex.query("users:getById", { id: req.user.id });

    if (!user) {
      console.error("[Auth Middleware - requireCompleteProfile] Error fetching user");
      return res.status(401).json({ success: false, message: "User not found" });
    }

    if (!user.profile_complete && req.user.user_type === "STUDENT") {
      console.error("[Auth Middleware - requireCompleteProfile] Error: Profile not complete for STUDENT");
      return res.status(403).json({ success: false, message: "Please complete your profile before making a booking." });
    }

    console.log("[Auth Middleware - requireCompleteProfile] Success");
    next();
  } catch (err) {
    console.error("[Auth Middleware - requireCompleteProfile] Catch Error:", err);
    next(err);
  }
};
