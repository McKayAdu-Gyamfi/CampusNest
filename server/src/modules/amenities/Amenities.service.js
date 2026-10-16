import { cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";

class AmenityServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "AmenityServiceError";
    this.statusCode = statusCode;
  }
}

// The Convex mutations throw a ConvexError carrying a structured `data.code`
// (production deployments redact plain Error messages, so the code is the
// only signal that survives the transport). The user-facing text lives here.
const wrapError = (error) => {
  switch (error?.data?.code) {
    case "DUPLICATE_AMENITY":
      return new AmenityServiceError("One or more of these amenities is already added", 409);
    case "HOSTEL_NOT_FOUND":
      return new AmenityServiceError("Hostel not found", 404);
    case "ROOM_NOT_FOUND":
      return new AmenityServiceError("Room not found", 404);
    default:
      return new AmenityServiceError(error.message, 400);
  }
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
