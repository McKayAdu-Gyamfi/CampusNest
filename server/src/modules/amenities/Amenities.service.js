import { cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";

class AmenityServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "AmenityServiceError";
    this.statusCode = statusCode;
  }
}

// The Convex mutations throw this exact message when a (parent, name) pair
// already exists — the replacement for Postgres' 23505 unique violation.
const DUPLICATE_MESSAGE = "One or more of these amenities is already added";

const wrapError = (error) => {
  if (error.message && error.message.includes(DUPLICATE_MESSAGE)) {
    return new AmenityServiceError(DUPLICATE_MESSAGE, 409);
  }
  return new AmenityServiceError(error.message, 400);
};

export const updateHostelAmenities = async (hostelId, amenities) => {
  try {
    return await cm(api.amenities.replaceForHostel, { hostelId, names: amenities ?? [] });
  } catch (error) {
    throw wrapError(error);
  }
};

export const addHostelAmenities = async (hostelId, amenities) => {
  try {
    return await cm(api.amenities.addForHostel, { hostelId, names: amenities ?? [] });
  } catch (error) {
    throw wrapError(error);
  }
};

export const removeHostelAmenity = async (id) => {
  try {
    return await cm(api.amenities.removeHostelAmenity, { id });
  } catch (error) {
    throw wrapError(error);
  }
};

export const updateRoomAmenities = async (roomId, amenities) => {
  try {
    return await cm(api.amenities.replaceForRoom, { roomId, names: amenities ?? [] });
  } catch (error) {
    throw wrapError(error);
  }
};

export const addRoomAmenities = async (roomId, amenities) => {
  try {
    return await cm(api.amenities.addForRoom, { roomId, names: amenities ?? [] });
  } catch (error) {
    throw wrapError(error);
  }
};

export const removeRoomAmenity = async (id) => {
  try {
    return await cm(api.amenities.removeRoomAmenity, { id });
  } catch (error) {
    throw wrapError(error);
  }
};
