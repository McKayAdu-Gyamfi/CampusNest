import { supabase } from "../../config/db.js";

// GET /api/reviews?hostel_id=123
export const getReviews = async (req, res, next) => {
  try {
    const { hostel_id } = req.query;

    let query = supabase.from("REVIEW").select("*, USERS:student_id (email)");

    if (hostel_id) query = query.eq("hostel_id", hostel_id);

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/reviews
export const createReview = async (req, res, next) => {
  try {
    const { hostel_id } = req.body;

    // A student can only review a hostel they've actually stayed at —
    // require at least one CONFIRMED or CHECKED_OUT booking for a room in
    // this hostel before allowing the review.
    const { data: rooms, error: roomsError } = await supabase
      .from("ROOM")
      .select("id")
      .eq("hostel_id", hostel_id);

    if (roomsError) throw roomsError;
    const roomIds = (rooms || []).map((r) => r.id);

    let hasStayed = false;
    if (roomIds.length > 0) {
      const { data: stay, error: stayError } = await supabase
        .from("BOOKING")
        .select("id")
        .eq("student_id", req.user.id)
        .in("room_id", roomIds)
        .in("status", ["CONFIRMED", "CHECKED_OUT"])
        .limit(1);

      if (stayError) throw stayError;
      hasStayed = !!(stay && stay.length > 0);
    }

    if (!hasStayed) {
      return res.status(403).json({ success: false, message: "You can only review a hostel you've booked and stayed at" });
    }

    const payload = {
      ...req.body,
      student_id: req.user.id,
      created_at: new Date(),
      updated_at: new Date()
    };

    const { data, error } = await supabase
      .from("REVIEW")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
