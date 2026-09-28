import { supabase } from "../../config/db.js";
import * as amenitiesService from "../amenities/Amenities.service.js";
import { uploadImageToSupabase } from "../../utils/supabaseStorage.js";

// Keep HOSTEL.total_rooms/available_rooms in sync with the ROOM rows that
// actually exist for it. Read-then-write (not atomic under heavy concurrency,
// but consistent with how the rest of this codebase talks to Supabase).
const adjustHostelRoomCounts = async (hostelId, { totalDelta = 0, availableDelta = 0 }) => {
  if (!totalDelta && !availableDelta) return;

  const { data: hostel, error } = await supabase
    .from("HOSTEL")
    .select("total_rooms, available_rooms")
    .eq("id", hostelId)
    .single();

  if (error || !hostel) return;

  await supabase
    .from("HOSTEL")
    .update({
      total_rooms: Math.max(0, hostel.total_rooms + totalDelta),
      available_rooms: Math.max(0, hostel.available_rooms + availableDelta),
      updated_at: new Date(),
    })
    .eq("id", hostelId);
};

// GET /api/rooms?hostel_id=123
export const getRooms = async (req, res, next) => {
  try {
    const { hostel_id, min_price, max_price, room_type, is_available } = req.query;

    let query = supabase.from("ROOM").select("*, HOSTEL!inner(hostel_name)");

    if (hostel_id) {
      query = query.eq("hostel_id", hostel_id);
    }
    
    if (min_price && !isNaN(Number(min_price))) {
      query = query.gte("price_per_bed", Number(min_price));
    }
    
    if (max_price && !isNaN(Number(max_price))) {
      query = query.lte("price_per_bed", Number(max_price));
    }
    
    if (room_type) {
      query = query.eq("room_type", room_type);
    }
    
    if (is_available !== undefined && is_available !== "") {
      query = query.eq("is_available", is_available === "true");
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/rooms/:id
export const getRoomById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("ROOM")
      .select(`
        *,
        ROOM_IMAGE_URLS (*),
        ROOM_TOUR_SCENES (*),
        ROOM_AMENITY (*),
        HOSTEL (hostel_name, location)
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ success: false, message: "Room not found" });
      }
      throw error;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/rooms
export const createRoom = async (req, res, next) => {
  try {
    const { hostel_id } = req.body;

    // Verify the caller owns the hostel they're attaching this room to
    // (requireRole only confirms they're SOME manager, not this hostel's manager).
    const { data: hostel, error: hostelError } = await supabase
      .from("HOSTEL")
      .select("manager_id")
      .eq("id", hostel_id)
      .single();

    if (hostelError || !hostel) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }

    if (hostel.manager_id !== req.user.id && req.user.user_type !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this hostel" });
    }

    const payload = {
      ...req.body,
      current_occupancy: 0,
      is_available: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    const { data, error } = await supabase
      .from("ROOM")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    await adjustHostelRoomCounts(hostel_id, { totalDelta: 1, availableDelta: 1 });

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/rooms/:id
export const deleteRoom = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: room, error: fetchError } = await supabase
      .from("ROOM")
      .select("hostel_id, is_available")
      .eq("id", id)
      .single();

    if (fetchError || !room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    const { error } = await supabase.from("ROOM").delete().eq("id", id);
    if (error) throw error;

    await adjustHostelRoomCounts(room.hostel_id, {
      totalDelta: -1,
      availableDelta: room.is_available ? -1 : 0,
    });

    res.json({ success: true, message: "Room deleted successfully" });
  } catch (err) {
    next(err);
  }
};

export const syncRoomAvailability = async (roomId) => {
  try {
    const { data: room, error: fetchError } = await supabase
      .from("ROOM")
      .select("hostel_id, capacity, current_occupancy, is_available")
      .eq("id", roomId)
      .single();

    if (fetchError || !room) return;

    const is_available = room.current_occupancy < room.capacity;

    await supabase
      .from("ROOM")
      .update({ is_available })
      .eq("id", roomId);

    if (is_available !== room.is_available) {
      await adjustHostelRoomCounts(room.hostel_id, { availableDelta: is_available ? 1 : -1 });
    }
  } catch (err) {
    console.error("Error syncing room availability:", err);
  }
};

// PATCH /api/rooms/:id
export const updateRoom = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatePayload = { ...req.body, updated_at: new Date() };

    const { data, error } = await supabase
      .from("ROOM")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ success: false, message: "Room not found" });
      }
      throw error;
    }

    // Sync room availability if capacity or occupancy changed
    if (updatePayload.current_occupancy !== undefined || updatePayload.capacity !== undefined) {
      await syncRoomAvailability(id);
      // Optional: Update 'data.is_available' in the response to reflect correct state without refetching
      data.is_available = (updatePayload.current_occupancy ?? data.current_occupancy) < (updatePayload.capacity ?? data.capacity);
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ROOM AMENITIES

// PUT /api/rooms/:id/amenities
export const updateRoomAmenities = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amenities } = req.body;

    const data = await amenitiesService.updateRoomAmenities(id, amenities);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/rooms/:id/amenities
export const addRoomAmenity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amenities } = req.body;

    const data = await amenitiesService.addRoomAmenities(id, amenities);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/rooms/:id/amenities/:amenityId
export const removeRoomAmenity = async (req, res, next) => {
  try {
    const { amenityId } = req.params;

    await amenitiesService.removeRoomAmenity(amenityId);
    res.json({ success: true, message: "Amenity removed" });
  } catch (err) {
    next(err);
  }
};

// POST /api/rooms/:id/images
export const uploadRoomImages = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No images provided" });
    }

    const uploadedUrls = [];

    // Upload each file to Supabase Storage
    for (const file of req.files) {
      const publicUrl = await uploadImageToSupabase(file, 'standard_images', `rooms/${id}`);
      uploadedUrls.push(publicUrl);
    }

    // Prepare records for database insertion
    const imageRecords = uploadedUrls.map(url => ({
      room_id: id,
      image_url: url
    }));

    // Insert URLs into the database
    const { data, error } = await supabase
      .from("ROOM_IMAGE_URLS")
      .insert(imageRecords)
      .select();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/rooms/:id/tours/:sceneId
export const deleteRoomTourScene = async (req, res, next) => {
  try {
    const { sceneId } = req.params;

    // Delete the scene from the database
    const { error } = await supabase
      .from("ROOM_TOUR_SCENES")
      .delete()
      .eq("id", sceneId);

    if (error) throw error;

    res.json({ success: true, message: "Tour scene deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// POST /api/rooms/:id/tours
export const createRoomTourScene = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { scene_name, scene_config_url } = req.body;

    if (!scene_name || !scene_config_url) {
      return res.status(400).json({ success: false, message: "scene_name and scene_config_url are required" });
    }

    const { data: sceneData, error: sceneError } = await supabase
      .from("ROOM_TOUR_SCENES")
      .insert([{
        room_id: id,
        scene_name: scene_name,
        scene_config_url: scene_config_url
      }])
      .select()
      .single();

    if (sceneError) throw sceneError;

    res.status(201).json({ success: true, data: sceneData });
  } catch (err) {
    next(err);
  }
};
