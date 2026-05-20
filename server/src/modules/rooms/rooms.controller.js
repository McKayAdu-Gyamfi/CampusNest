import { convex } from "../../config/db.js";
import { uploadImageToConvex } from "../../utils/convexStorage.js";

// GET /api/rooms?hostel_id=123
export const getRooms = async (req, res, next) => {
  try {
    const { hostel_id, min_price, max_price, room_type, is_available } = req.query;

    const data = await convex.query("rooms:list", {
      hostel_id: hostel_id || undefined,
      min_price: min_price ? Number(min_price) : undefined,
      max_price: max_price ? Number(max_price) : undefined,
      room_type: room_type || undefined,
      is_available: is_available !== undefined && is_available !== "" ? is_available === "true" : undefined
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/rooms/:id
export const getRoomById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await convex.query("rooms:getById", { id });
    if (!data) return res.status(404).json({ success: false, message: "Room not found" });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/rooms
export const createRoom = async (req, res, next) => {
  try {
    const data = await convex.mutation("rooms:create", req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/rooms/:id
export const updateRoom = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await convex.mutation("rooms:update", { id, updates: req.body });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ROOM AMENITIES

export const updateRoomAmenities = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amenities } = req.body;
    const data = await convex.mutation("rooms:updateAmenities", { id, amenities });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const addRoomAmenity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amenities } = req.body;
    const data = await convex.mutation("rooms:addAmenities", { id, amenities });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const removeRoomAmenity = async (req, res, next) => {
  try {
    const { id, amenityId } = req.params;
    const data = await convex.mutation("rooms:removeAmenity", { id, amenity: amenityId });
    res.json({ success: true, message: "Amenity removed", data });
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
    for (const file of req.files) {
      const storageId = await uploadImageToConvex(file);
      uploadedUrls.push(storageId);
    }

    const data = await convex.mutation("rooms:addImages", { id, storageIds: uploadedUrls });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/rooms/:id/tours/:sceneId
export const deleteRoomTourScene = async (req, res, next) => {
  try {
    const { id, sceneId } = req.params; 
    const data = await convex.mutation("rooms:deleteTourScene", { id, scene_name: sceneId });
    res.json({ success: true, message: "Tour scene deleted successfully", data });
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

    const data = await convex.mutation("rooms:createTourScene", { id, scene_name, scene_config_url });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
