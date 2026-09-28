import { supabase } from "../../config/db.js";

// Utility to create consistent errors
class UserServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "UserServiceError";
    this.statusCode = statusCode;
  }
}

export const getMe = async (userId) => {
  const { data, error } = await supabase
    .from("user")
    .select("*, ROOM:current_room_id (room_number, HOSTEL (hostel_name))")
    .eq("id", userId)
    .single();

  if (error) throw new UserServiceError(error.message, 400);
  return data;
};

export const updateMe = async (userId, updates, userType) => {
  if (userType === "HOSTEL_MANAGER") {
    // Managers can't change their type or see student fields
    const { user_type, student_id, course, profile_complete, ...safeUpdates } = updates;

    // safeUpdates.updated_at = new Date(); // If using updated_at auto-updates

    const { data, error } = await supabase
      .from("user")
      .update(safeUpdates)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw new UserServiceError(error.message, 400);
    return data;
  }

  if (userType === "STUDENT") {
    const current = await supabase
      .from("user")
      .select("student_id, course")
      .eq("id", userId)
      .single();

    if (current.error) throw new UserServiceError(current.error.message, 400);

    const merged = { ...current.data, ...updates };
    const profileComplete = !!(merged.student_id && merged.course);

    const { data, error } = await supabase
      .from("user")
      .update({ ...updates, profile_complete: profileComplete })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw new UserServiceError(error.message, 400);
    return data;
  }

  // Admin updating themselves (fallback)
  const { user_type, ...safeUpdates } = updates;
  const { data, error } = await supabase
    .from("user")
    .update(safeUpdates)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new UserServiceError(error.message, 400);
  return data;
};

export const completeProfile = async (userId, data) => {
  // Essentially an update for students that specifically aims to complete profile
  const { student_id, course } = data;
  const profileComplete = !!(student_id && course);

  const { data: updatedUser, error } = await supabase
    .from("user")
    .update({ student_id, course, profile_complete: profileComplete })
    .eq("id", userId)
    .select();

  if (error) throw new UserServiceError(error.message, 400);
  if (!updatedUser || updatedUser.length === 0) {
    throw new UserServiceError("User profile not found in database", 404);
  }

  return updatedUser[0];
};

export const completeManagerProfile = async (userId, data) => {
  const { payment_details } = data;
  const profileComplete = !!payment_details;

  const { data: updatedUser, error } = await supabase
    .from("user")
    .update({ payment_details, profile_complete: profileComplete })
    .eq("id", userId)
    .select();

  if (error) throw new UserServiceError(error.message, 400);
  if (!updatedUser || updatedUser.length === 0) {
    throw new UserServiceError("User profile not found in database", 404);
  }

  return updatedUser[0];
};

export const getMyHostels = async (userId) => {
  // Assuming a manager can have many hostels assigned to them where manager_id = id
  const { data, error } = await supabase
    .from("HOSTEL")
    .select("*")
    .eq("manager_id", userId);

  if (error) throw new UserServiceError(error.message, 400);
  return data;
};

export const listUsers = async () => {
  const { data, error } = await supabase
    .from("user")
    .select("*");

  if (error) throw new UserServiceError(error.message, 400);
  return data;
};

export const getUserById = async (id) => {
  const { data, error } = await supabase
    .from("user")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new UserServiceError(error.message, 400);
  return data;
};

export const adminUpdateUser = async (id, updates) => {
  // Admin can update almost anything
  const { data, error } = await supabase
    .from("user")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new UserServiceError(error.message, 400);
  return data;
};

// Flow 3: ADMIN creates another ADMIN 
import { auth } from "../../../auth.js"; // Needs auth to create user

export const createAdmin = async (adminDetails) => {
  const { email, password, name } = adminDetails;

  // Create user via BetterAuth
  const response = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: name || email.split("@")[0]
    }
  });

  if (response.error) {
    throw new UserServiceError(response.error.message, 400);
  }

  const { user } = response;

  // Immediately set user_type to ADMIN
  const { data, error } = await supabase
    .from("user")
    .update({ user_type: "ADMIN", profile_complete: true })
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw new UserServiceError(error.message, 400);
  return data;
};
