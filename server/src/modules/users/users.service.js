import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";
import { isProfileComplete } from "./profileCompleteness.js";

class UserServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "UserServiceError";
    this.statusCode = statusCode;
  }
}

export const getMe = async (userId) => {
  const user = await cq(api.users.getMeWithRoom, { id: userId });
  if (!user) throw new UserServiceError("User profile not found in database", 404);
  return user;
};

export const updateMe = async (userId, updates, userType) => {
  const { user_type, profile_complete, ...safeUpdates } = updates;
  const current = await cq(api.users.getMeWithRoom, { id: userId });
  if (!current) throw new UserServiceError("User profile not found in database", 404);
  // Empty string clears a field. Completeness is always derived, never client-set.
  const clean = Object.fromEntries(Object.entries(safeUpdates).map(([k, v]) => [k, v === "" ? null : v]));
  const patch = { ...clean };
  if (userType === "STUDENT" || userType === "HOSTEL_MANAGER") {
    const merged = { ...current };
    for (const [k, v] of Object.entries(clean)) merged[k] = v;
    patch.profile_complete = isProfileComplete(merged, userType);
  }

  const updated = await cm(api.users.updateProfile, { id: userId, patch });
  if (!updated) throw new UserServiceError("User profile not found in database", 404);
  return updated;
};

export const completeProfile = async (userId, data) => {
  const { student_id, course } = data;
  const updated = await cm(api.users.updateProfile, {
    id: userId,
    patch: { student_id, course, profile_complete: !!(student_id && course) },
  });
  if (!updated) throw new UserServiceError("User profile not found in database", 404);
  return updated;
};

export const completeManagerProfile = async (userId, data) => {
  const { payment_details } = data;
  const updated = await cm(api.users.updateProfile, {
    id: userId,
    patch: { payment_details, profile_complete: !!payment_details },
  });
  if (!updated) throw new UserServiceError("User profile not found in database", 404);
  return updated;
};

export const getMyHostels = async (userId) => {
  return await cq(api.hostels.listByManager, { managerId: userId });
};

export const listUsers = async () => {
  return await cq(api.users.listAll, {});
};

export const getUserById = async (id) => {
  const user = await cq(api.users.getMeWithRoom, { id });
  if (!user) throw new UserServiceError("User not found", 404);
  return user;
};

export const adminUpdateUser = async (id, updates) => {
  const updated = await cm(api.users.updateProfile, { id, patch: updates });
  if (!updated) throw new UserServiceError("User not found", 404);
  return updated;
};

// Flow 3: ADMIN creates another ADMIN
import { auth } from "../../../auth.js";

export const createAdmin = async (adminDetails) => {
  const { email, password, name } = adminDetails;

  const response = await auth.api.signUpEmail({
    body: { email, password, name: name || email.split("@")[0] },
  });

  if (response.error) {
    throw new UserServiceError(response.error.message, 400);
  }

  const { user } = response;
  const updated = await cm(api.users.updateProfile, {
    id: user.id,
    patch: { user_type: "ADMIN", profile_complete: true },
  });
  if (!updated) throw new UserServiceError("Newly created admin not found", 500);
  return updated;
};
