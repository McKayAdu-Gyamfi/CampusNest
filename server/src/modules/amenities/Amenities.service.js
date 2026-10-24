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
      // Deliberately NOT relabelled as a client error. An unrecognised
      // failure here is an infrastructure problem (e.g. deployment/version
      // skew making Convex reject an argument it doesn't know about), and
      // such an ArgumentValidationError echoes the whole args object —
      // including the adapter secret — into error.message. Attaching a
      // statusCode would make errorHandler treat the message as
      // deliberate and return it verbatim in the response body. Returned
      // bare, it has no statusCode, so it falls through to the generic
      // 500 path which logs the full detail server-side and tells the
      // caller nothing.
      return error;
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

export const removeHostelAmenity = async (id, hostelId) => {
  try {
    return await cm(api.amenities.removeHostelAmenity, { id, hostelId });
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

export const removeRoomAmenity = async (id, roomId) => {
  try {
    return await cm(api.amenities.removeRoomAmenity, { id, roomId });
  } catch (error) {
    throw wrapError(error);
  }
};
