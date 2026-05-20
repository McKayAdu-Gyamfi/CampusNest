import { convex } from "../../config/db.js";
import { auth } from "../../../auth.js";

class UserServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "UserServiceError";
    this.statusCode = statusCode;
  }
}

export const getMe = async (userId) => {
  try {
    const data = await convex.query("users:getById", { id: userId });
    if (!data) throw new UserServiceError("User not found", 404);
    return data;
  } catch (err) {
    throw new UserServiceError(err.message, 400);
  }
};

export const updateMe = async (userId, updates, userType) => {
  try {
    return await convex.mutation("users:updateMe", { id: userId, updates, userType });
  } catch (err) {
    throw new UserServiceError(err.message, 400);
  }
};

export const completeProfile = async (userId, data) => {
  try {
    const result = await convex.mutation("users:completeProfile", { id: userId, ...data });
    if (!result) throw new UserServiceError("User profile not found in database", 404);
    return result;
  } catch (err) {
    throw new UserServiceError(err.message, 400);
  }
};

export const completeManagerProfile = async (userId, data) => {
  try {
    const result = await convex.mutation("users:completeManagerProfile", { id: userId, ...data });
    if (!result) throw new UserServiceError("User profile not found in database", 404);
    return result;
  } catch (err) {
    throw new UserServiceError(err.message, 400);
  }
};

export const getMyHostels = async (userId) => {
  try {
    return await convex.query("users:getMyHostels", { manager_id: userId });
  } catch (err) {
    throw new UserServiceError(err.message, 400);
  }
};

export const listUsers = async () => {
  try {
    return await convex.query("users:list");
  } catch (err) {
    throw new UserServiceError(err.message, 400);
  }
};

export const getUserById = async (id) => {
  try {
    return await convex.query("users:getById", { id });
  } catch (err) {
    throw new UserServiceError(err.message, 400);
  }
};

export const adminUpdateUser = async (id, updates) => {
  try {
    return await convex.mutation("users:adminUpdateUser", { id, updates });
  } catch (err) {
    throw new UserServiceError(err.message, 400);
  }
};

export const createAdmin = async (adminDetails) => {
  const { email, password, name } = adminDetails;

  const response = await auth.api.signUpEmail({
    body: { email, password, name: name || email.split("@")[0] }
  });

  if (response.error) {
    throw new UserServiceError(response.error.message, 400);
  }

  const { user } = response;

  try {
    return await convex.mutation("users:updateAuthUserType", {
      id: user.id,
      user_type: "ADMIN",
      profile_complete: true
    });
  } catch (err) {
    throw new UserServiceError(err.message, 400);
  }
};
