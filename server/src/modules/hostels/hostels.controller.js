import { convex } from "../../config/db.js";
import * as amenitiesService from "../amenities/Amenities.service.js";
import { uploadImageToConvex } from "../../utils/convexStorage.js";

// GET /api/hostels
export const getHostels = async (req, res, next) => {
  try {
    const { search, max_distance } = req.query;

    const data = await convex.query("hostels:list", { 
      search: search || undefined, 
      max_distance: max_distance ? Number(max_distance) : undefined 
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/hostels/:id
export const getHostelById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const data = await convex.query("hostels:getById", { id });

    if (!data) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};


//  I will have to add more field to this create hostel like description and manager info

// POST /api/hostels
export const createHostel = async (req, res, next) => {
  try {
    const { hostel_name, location, description, total_rooms, available_rooms, distance_from_campus } = req.body;

    // Force manager_id to be the authenticated user's ID
    const manager_id = req.user.id;

    const payload = { 
      hostel_name, 
      location, 
      description, 
      total_rooms: Number(total_rooms), 
      available_rooms: available_rooms ? Number(available_rooms) : 0, 
      distance_from_campus: distance_from_campus ? Number(distance_from_campus) : undefined,
      manager_id,
    };

    const data = await convex.mutation("hostels:create", payload);

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/hostels/:id
export const updateHostel = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Note: To implement update in Convex, we would create a hostels:update mutation.
    // For now, this is a placeholder indicating where the Convex mutation goes.
    // const data = await convex.mutation("hostels:update", { id, ...req.body });

    res.json({ success: true, data: "Update requires Convex mutation implementation" });
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
    const { amenityId } = req.params;

    await amenitiesService.removeHostelAmenity(amenityId);
    res.json({ success: true, message: "Amenity removed" });
  } catch (err) {
    next(err);
  }
};

// POST /api/hostels/:id/images
export const uploadHostelImages = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No images provided" });
    }

    const uploadedUrls = [];

    // Upload each file to Convex Storage
    for (const file of req.files) {
      const storageId = await uploadImageToConvex(file);
      uploadedUrls.push(storageId);
    }

    // Prepare records for database insertion
    // Note: Convex stores image URLs as an array inside the hostel document
    // We would need a mutation to append these storage IDs to the hostel's image_urls array.
    // await convex.mutation("hostels:addImages", { id, storageIds: uploadedUrls });

    res.status(201).json({ success: true, data: uploadedUrls });
  } catch (err) {
    next(err);
  }
};

