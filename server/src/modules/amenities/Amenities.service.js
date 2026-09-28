import { supabase } from "../../config/db.js";

class AmenityServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "AmenityServiceError";
    this.statusCode = statusCode;
  }
}

// HOSTEL_AMENITY/ROOM_AMENITY both have a UNIQUE(*_id, name) constraint —
// Postgres code 23505 means the caller tried to add an amenity that's
// already there. Surface that as a clean 409 instead of the raw DB error.
const wrapInsertError = (error) => {
  if (error.code === "23505") {
    return new AmenityServiceError("One or more of these amenities is already added", 409);
  }
  return new AmenityServiceError(error.message, 400);
};

// HOSTEL AMENITIES

export const updateHostelAmenities = async (hostelId, amenities) => {
  // 1. Delete all existing amenities for this hostel
  const { error: deleteError } = await supabase
    .from("HOSTEL_AMENITY")
    .delete()
    .eq("hostel_id", hostelId);
    
  if (deleteError) throw new AmenityServiceError(deleteError.message, 400);

  // 2. Insert the new ones
  if (amenities && amenities.length > 0) {
    const amenitiesToInsert = amenities.map(name => ({
      hostel_id: hostelId,
      name
    }));
    
    const { data, error: insertError } = await supabase
      .from("HOSTEL_AMENITY")
      .insert(amenitiesToInsert)
      .select();
      
    if (insertError) throw wrapInsertError(insertError);
    return data;
  }
  return [];
};

export const addHostelAmenities = async (hostelId, amenities) => {
  const amenitiesToInsert = amenities.map(name => ({
    hostel_id: hostelId,
    name
  }));
  
  const { data, error } = await supabase
    .from("HOSTEL_AMENITY")
    .insert(amenitiesToInsert)
    .select();
    
  if (error) throw wrapInsertError(error);
  return data;
};

export const removeHostelAmenity = async (id) => {
  const { error } = await supabase
    .from("HOSTEL_AMENITY")
    .delete()
    .eq("id", id);
    
  if (error) throw new AmenityServiceError(error.message, 400);
  return { success: true };
};

// ROOM AMENITIES

export const updateRoomAmenities = async (roomId, amenities) => {
  // 1. Delete all existing amenities for this room
  const { error: deleteError } = await supabase
    .from("ROOM_AMENITY")
    .delete()
    .eq("room_id", roomId);
    
  if (deleteError) throw new AmenityServiceError(deleteError.message, 400);

  // 2. Insert the new ones
  if (amenities && amenities.length > 0) {
    const amenitiesToInsert = amenities.map(name => ({
      room_id: roomId,
      name
    }));
    
    const { data, error: insertError } = await supabase
      .from("ROOM_AMENITY")
      .insert(amenitiesToInsert)
      .select();
      
    if (insertError) throw wrapInsertError(insertError);
    return data;
  }
  return [];
};

export const addRoomAmenities = async (roomId, amenities) => {
  const amenitiesToInsert = amenities.map(name => ({
    room_id: roomId,
    name
  }));
  
  const { data, error } = await supabase
    .from("ROOM_AMENITY")
    .insert(amenitiesToInsert)
    .select();
    
  if (error) throw wrapInsertError(error);
  return data;
};

export const removeRoomAmenity = async (id) => {
  const { error } = await supabase
    .from("ROOM_AMENITY")
    .delete()
    .eq("id", id);
    
  if (error) throw new AmenityServiceError(error.message, 400);
  return { success: true };
};
