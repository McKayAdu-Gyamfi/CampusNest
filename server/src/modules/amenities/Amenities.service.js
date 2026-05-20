import { convex } from "../../config/db.js";

class AmenityServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "AmenityServiceError";
    this.statusCode = statusCode;
  }
}

// HOSTEL AMENITIES

export const updateHostelAmenities = async (hostelId, amenities) => {
  try {
    return await convex.mutation("hostels:updateAmenities", { id: hostelId, amenities });
  } catch (error) {
    throw new AmenityServiceError(error.message, 400);
  }
};

export const addHostelAmenities = async (hostelId, amenities) => {
  try {
    return await convex.mutation("hostels:addAmenities", { id: hostelId, amenities });
  } catch (error) {
    throw new AmenityServiceError(error.message, 400);
  }
};

export const removeHostelAmenity = async (hostelId, amenityName) => {
  try {
    return await convex.mutation("hostels:removeAmenity", { id: hostelId, amenity: amenityName });
  } catch (error) {
    throw new AmenityServiceError(error.message, 400);
  }
};

// ROOM AMENITIES

export const updateRoomAmenities = async (roomId, amenities) => {
  try {
    return await convex.mutation("rooms:updateAmenities", { id: roomId, amenities });
  } catch (error) {
    throw new AmenityServiceError(error.message, 400);
  }
};

export const addRoomAmenities = async (roomId, amenities) => {
  try {
    return await convex.mutation("rooms:addAmenities", { id: roomId, amenities });
  } catch (error) {
    throw new AmenityServiceError(error.message, 400);
  }
};

export const removeRoomAmenity = async (roomId, amenityName) => {
  try {
    return await convex.mutation("rooms:removeAmenity", { id: roomId, amenity: amenityName });
  } catch (error) {
    throw new AmenityServiceError(error.message, 400);
  }
};
