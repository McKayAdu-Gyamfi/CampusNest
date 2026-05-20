import { auth } from "../../../auth.js";
import { convex } from "../../config/db.js";

// POST /api/auth/register
export const registerManager = async (req, res, next) => {
  try {
    const { email, password, user_type, name } = req.body;

    // 1. Call BetterAuth to create auth user
    const response = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: name || email.split("@")[0]
      }
    });
    if (response.error) {
      console.error("[Auth Controller - registerManager] BetterAuth Error:", response.error.message);
      return res.status(400).json({ success: false, message: response.error.message });
    }

    const { user } = response;

    // 2. Immediately update the new user in Convex to specify type
    // TODO: Migrate to Convex mutation
    /*
    const updatedUser = await convex.mutation("users:update", {
        id: user.id,
        user_type, // "HOSTEL_MANAGER"
        profile_complete: false 
    });
    */
    const updatedUser = user;

    console.log("[Auth Controller - registerManager] Success for user:", updatedUser?.id);
    res.status(201).json({ success: true, data: updatedUser });
  } catch (err) {
    console.error("[Auth Controller - registerManager] Catch Error:", err);
    next(err);
  }
};
// POST /api/auth/sign-up/email
export const signUp = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const response = await auth.api.signUpEmail({
      body: { email, password, name: name || email.split("@")[0] },
      asResponse: true
    });

    // Pass cookies & headers from Better Auth response back to Express
    response.headers.forEach((value, key) => {
      res.append(key, value);
    });

    const data = await response.json().catch(() => ({}));
    if (response.status >= 400) console.error("[Auth] Sign Up error:", data);
    else console.log("[Auth] Sign Up success for:", email);

    res.status(response.status).json(data);
  } catch (err) {
    console.error("[Auth Controller - signUp] Error:", err);
    next(err);
  }
};

// POST /api/auth/sign-in/email
export const signIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const response = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true
    });

    response.headers.forEach((value, key) => {
      res.append(key, value);
    });

    const data = await response.json().catch(() => ({}));
    if (response.status >= 400) console.error("[Auth] Sign In error:", data);
    else console.log("[Auth] Sign In success for:", email);

    res.status(response.status).json(data);
  } catch (err) {
    console.error("[Auth Controller - signIn] Error:", err);
    next(err);
  }
};

// POST /api/auth/sign-out
export const signOut = async (req, res, next) => {
  try {
    const response = await auth.api.signOut({
      headers: req.headers,
      asResponse: true
    });

    response.headers.forEach((value, key) => {
      res.append(key, value);
    });

    const data = await response.json().catch(() => ({}));
    console.log("[Auth] Sign Out complete");
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[Auth Controller - signOut] Error:", err);
    next(err);
  }
};
