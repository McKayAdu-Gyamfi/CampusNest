import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";
import * as amenitiesService from "../amenities/Amenities.service.js";
import { uploadImageToConvex } from "../../utils/convexStorage.js";

// GET /api/rooms?hostel_id=123
export const getRooms = async (req, res, next) => {
  try {
    const { hostel_id, min_price, max_price, room_type, is_available } = req.query;

    const args = {};
    if (hostel_id) args.hostelId = String(hostel_id);
    if (min_price && !isNaN(Number(min_price))) args.minPrice = Number(min_price);
    if (max_price && !isNaN(Number(max_price))) args.maxPrice = Number(max_price);
    if (room_type) args.roomType = String(room_type);
    if (is_available !== undefined && is_available !== "") args.isAvailable = is_available === "true";

    const data = await cq(api.rooms.list, args);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/rooms/:id
export const getRoomById = async (req, res, next) => {
  try {
    const data = await cq(api.rooms.getByIdWithRelations, { id: req.params.id });
    if (!data) {
      return res.status(404).json({ success: false, message: "Room not found" });
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
    // (requireRole only confirms they're SOME manager, not this hostel's).
    const hostel = await cq(api.hostels.getManagerId, { id: hostel_id });

    if (!hostel) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }

    if (hostel.manager_id !== req.user.id && req.user.user_type !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this hostel" });
    }

    const data = await cm(api.rooms.create, { data: req.body });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/rooms/:id
export const deleteRoom = async (req, res, next) => {
  try {
    const removed = await cm(api.rooms.remove, { id: req.params.id });
    if (!removed) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }
    res.json({ success: true, message: "Room deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/rooms/:id
export const updateRoom = async (req, res, next) => {
  try {
    const data = await cm(api.rooms.update, { id: req.params.id, patch: req.body });
    if (!data) {
      return res.status(404).json({ success: false, message: "Room not found" });
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
    const { id, amenityId } = req.params;

    await amenitiesService.removeRoomAmenity(amenityId, id);
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

    // Upload each file to Convex storage
    for (const file of req.files) {
      const publicUrl = await uploadImageToConvex(file);
      uploadedUrls.push(publicUrl);
    }

    const data = await cm(api.rooms.addImages, { roomId: id, urls: uploadedUrls });

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/rooms/:id/tours/:sceneId
export const deleteRoomTourScene = async (req, res, next) => {
  try {
    const { id, sceneId } = req.params;

    await cm(api.rooms.removeTourScene, { id: sceneId, roomId: id });

    res.json({ success: true, message: "Tour scene deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// POST /api/rooms/:id/tours/generate
// Orchestrates the panorama pipeline: this is the ONLY caller the
// temp-pano-api microservice trusts (via a shared internal key never
// exposed to the browser). Previously the frontend called that service
// directly with no auth at all and a client-supplied room_id — anyone
// could generate/overwrite tour data for any room. Now the client uploads
// here (same requireAuth + verifyRoomOwnership gate as every other room
// mutation), and this handler is the one that talks to the Python service.
export const generateRoomTour = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { scene_name, hotspots } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "An equirectangular panorama image is required" });
    }
    if (!scene_name) {
      return res.status(400).json({ success: false, message: "scene_name is required" });
    }

    const panoApiUrl = process.env.PANO_API_URL;
    const panoApiKey = process.env.PANO_API_KEY;
    if (!panoApiUrl || !panoApiKey) {
      throw new Error("PANO_API_URL/PANO_API_KEY are not configured on this server");
    }

    const form = new FormData();
    form.append("room_id", id);
    if (hotspots) form.append("hotspots", typeof hotspots === "string" ? hotspots : JSON.stringify(hotspots));
    form.append("image", new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);

    const panoResponse = await fetch(`${panoApiUrl}/api/panorama/tour`, {
      method: "POST",
      headers: { "X-Internal-Key": panoApiKey },
      body: form,
    });

    const panoResult = await panoResponse.json().catch(() => ({}));
    if (!panoResponse.ok) {
      return res.status(502).json({ success: false, message: panoResult.detail || "Panorama processing failed" });
    }

    const sceneData = await cm(api.rooms.addTourScene, {
      roomId: id,
      scene_name,
      scene_config_url: panoResult.tour_url,
    });

    res.status(201).json({ success: true, data: sceneData });
  } catch (err) {
    next(err);
  }
};

// POST /api/rooms/:id/tours
// Registers a scene from an already-generated config URL directly (e.g. one
// produced out-of-band) without re-running the panorama pipeline.
export const createRoomTourScene = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { scene_name, scene_config_url } = req.body;

    if (!scene_name || !scene_config_url) {
      return res.status(400).json({ success: false, message: "scene_name and scene_config_url are required" });
    }

    const sceneData = await cm(api.rooms.addTourScene, { roomId: id, scene_name, scene_config_url });

    res.status(201).json({ success: true, data: sceneData });
  } catch (err) {
    next(err);
  }
};
