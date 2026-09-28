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
    const { hostel_id } = req.body;

    const { data: hostel, error: hostelError } = await supabase
      .from("HOSTEL")
      .select("manager_id")
      .eq("id", hostel_id)
      .single();

    if (hostelError || !hostel) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }

    if (req.user.user_type === "STUDENT") {
      // A student can only complain about a hostel they've actually booked.
      const { data: rooms, error: roomsError } = await supabase
        .from("ROOM")
        .select("id")
        .eq("hostel_id", hostel_id);

      if (roomsError) throw roomsError;
      const roomIds = (rooms || []).map((r) => r.id);

      let hasBooked = false;
      if (roomIds.length > 0) {
        const { data: booking, error: bookingError } = await supabase
          .from("BOOKING")
          .select("id")
          .eq("student_id", req.user.id)
          .in("room_id", roomIds)
          .limit(1);

        if (bookingError) throw bookingError;
        hasBooked = !!(booking && booking.length > 0);
      }

      if (!hasBooked) {
        return res.status(403).json({ success: false, message: "You can only file a complaint about a hostel you've booked" });
      }
    }

    const payload = {
      ...req.body,
      // A student can only ever file a complaint as themselves, never on
      // behalf of another student_id passed in the body.
      student_id: req.user.user_type === "STUDENT" ? req.user.id : req.body.student_id,
      hostel_manager_id: hostel.manager_id,
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

    const { data: complaint, error: fetchError } = await supabase
      .from("COMPLAINT")
      .select("hostel_manager_id")
      .eq("id", id)
      .single();

    if (fetchError || !complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    // Only the manager of the hostel this complaint was filed against (or
    // an admin) can change its status — previously this had no check at
    // all, so any authenticated user, including a student, could do this.
    if (req.user.user_type !== "ADMIN" && complaint.hostel_manager_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not manage the hostel for this complaint" });
    }

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
