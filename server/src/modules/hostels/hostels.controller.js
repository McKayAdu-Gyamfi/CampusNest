import { supabase } from "../../config/db.js";
import * as amenitiesService from "../amenities/Amenities.service.js";
import { uploadImageToSupabase } from "../../utils/supabaseStorage.js";

// GET /api/hostels
export const getHostels = async (req, res, next) => {
  try {
    const { search, max_distance } = req.query;

    let query = supabase
      .from("HOSTEL")
      .select("*, manager:manager_id (id, email)");

    if (search) {
      query = query.or(`hostel_name.ilike.%${search}%,location.ilike.%${search}%`);
    }

    if (max_distance && !isNaN(Number(max_distance))) {
      query = query.lte("distance_from_campus", Number(max_distance));
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/hostels/:id
export const getHostelById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Combining table fetches using Supabase joins
    const { data, error } = await supabase
      .from("HOSTEL")
      .select(`
        *,
        ROOM (*),
        HOSTEL_IMAGE_URLS (*),
        HOSTEL_AMENITY (*)
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ success: false, message: "Hostel not found" });
      }
      throw error;
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

    // Check how many hostels this manager already has
    const { count, error: countError } = await supabase
      .from("HOSTEL")
      .select("*", { count: "exact", head: true })
      .eq("manager_id", manager_id);

    if (countError) throw countError;

    if (count >= 2) {
      return res.status(400).json({ success: false, message: "A manager can only create up to 2 hostels." });
    }

    const payload = { 
      hostel_name, 
      location, 
      description, 
      total_rooms, 
      available_rooms: available_rooms ?? 0, 
      distance_from_campus,
      manager_id, 
      created_at: new Date(), 
      updated_at: new Date() 
    };

    const { data, error } = await supabase
      .from("HOSTEL")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/hostels/:id
export const updateHostel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatePayload = { ...req.body, updated_at: new Date() };

    const { data, error } = await supabase
      .from("HOSTEL")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ success: false, message: "Hostel not found" });
      }
      throw error;
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

    // Upload each file to Supabase Storage
    for (const file of req.files) {
      const publicUrl = await uploadImageToSupabase(file, 'standard_images', `hostels/${id}`);
      uploadedUrls.push(publicUrl);
    }

    // Prepare records for database insertion
    const imageRecords = uploadedUrls.map(url => ({
      hostel_id: id,
      image_url: url
    }));

    // Insert URLs into the database
    const { data, error } = await supabase
      .from("HOSTEL_IMAGE_URLS")
      .insert(imageRecords)
      .select();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

