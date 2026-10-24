import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";
import * as amenitiesService from "../amenities/Amenities.service.js";
import { uploadImageToConvex } from "../../utils/convexStorage.js";

// GET /api/hostels
export const getHostels = async (req, res, next) => {
  try {
    const { search, max_distance } = req.query;
    const args = {};
    if (search) args.search = String(search);
    if (max_distance && !isNaN(Number(max_distance))) args.maxDistance = Number(max_distance);

    const data = await cq(api.hostels.listApproved, args);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/hostels/:id
export const getHostelById = async (req, res, next) => {
  try {
    const data = await cq(api.hostels.getByIdWithRelations, { id: req.params.id });
    if (!data) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/hostels
export const createHostel = async (req, res, next) => {
  try {
    const { hostel_name, location, description, total_rooms, available_rooms, distance_from_campus } = req.body;
    // Force manager_id to be the authenticated user's ID
    const manager_id = req.user.id;

    const count = await cq(api.hostels.countByManager, { managerId: manager_id });
    if (count >= 2) {
      return res.status(400).json({ success: false, message: "A manager can only create up to 2 hostels." });
    }

    const data = await cm(api.hostels.create, {
      data: {
        hostel_name, location, description, total_rooms,
        available_rooms: available_rooms ?? 0,
        distance_from_campus, manager_id,
        status: "PENDING", // requires admin approval before appearing in public listings
      },
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/hostels/:id
export const updateHostel = async (req, res, next) => {
  try {
    // status/manager_id are intentionally excluded here even though the
    // caller already owns this hostel — approval and ownership transfer
    // are admin-only actions (status via PATCH /:id/status below).
    const { status, manager_id, ...rest } = req.body;

    const data = await cm(api.hostels.update, { id: req.params.id, patch: rest });
    if (!data) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/hostels/:id/status
// Admin-only approval gate: any self-registered manager's hostel would
// otherwise appear in public listings immediately.
export const updateHostelStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be PENDING, APPROVED, or REJECTED" });
    }

    const data = await cm(api.hostels.update, { id: req.params.id, patch: { status } });
    if (!data) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// HOSTEL AMENITIES

// PUT /api/hostels/:id/amenities
export const updateHostelAmenities = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amenities } = req.body;

    const data = await amenitiesService.updateHostelAmenities(id, amenities);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/hostels/:id/amenities
export const addHostelAmenity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amenities } = req.body;

    const data = await amenitiesService.addHostelAmenities(id, amenities);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/hostels/:id/amenities/:amenityId
export const removeHostelAmenity = async (req, res, next) => {
  try {
    const { id, amenityId } = req.params;

    await amenitiesService.removeHostelAmenity(amenityId, id);
    res.json({ success: true, message: "Amenity removed" });
  } catch (err) {
    next(err);
  }
};

export const uploadHostelImages = async (req, res, next) => {
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

    const data = await cm(api.hostels.addImages, { hostelId: id, urls: uploadedUrls });

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

