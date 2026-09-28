import { supabase } from "../../config/db.js";

// GET /api/complaints
export const getComplaints = async (req, res, next) => {
  try {
    const { hostel_id, student_id } = req.query;

    let query = supabase.from("COMPLAINT").select(`
      *,
      USERS:student_id (email, profile_complete),
      HOSTEL (hostel_name)
    `);

    if (req.user.user_type === "STUDENT") {
      // Students can only ever see their own complaints, regardless of
      // whatever student_id they pass in the query string.
      query = query.eq("student_id", req.user.id);
    } else {
      if (student_id) query = query.eq("student_id", student_id);
      if (req.user.user_type === "HOSTEL_MANAGER") {
        // Managers only see complaints for hostels they manage.
        query = query.eq("hostel_manager_id", req.user.id);
      }
    }

    if (hostel_id) query = query.eq("hostel_id", hostel_id);

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/complaints/:id
export const getComplaintById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("COMPLAINT")
      .select("*, USERS:student_id (email, profile_complete)")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    if (req.user.user_type === "STUDENT" && data.student_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this complaint" });
    }
    if (req.user.user_type === "HOSTEL_MANAGER" && data.hostel_manager_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not manage the hostel for this complaint" });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/complaints
export const createComplaint = async (req, res, next) => {
  try {
    // If manager_id is mapped later by a trigger or derived from HOSTEL, we allow creation with just student and hostel.
    const payload = {
      ...req.body,
      status: "OPEN",
      created_at: new Date(),
      updated_at: new Date()
    };

    const { data, error } = await supabase
      .from("COMPLAINT")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/complaints/:id
export const updateComplaintStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabase
      .from("COMPLAINT")
      .update({ status, updated_at: new Date() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
