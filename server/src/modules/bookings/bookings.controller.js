import { supabase } from "../../config/db.js";
import { syncRoomAvailability } from "../rooms/rooms.controller.js";

// GET /api/bookings?student_id=123
export const getBookings = async (req, res, next) => {
  try {
    const { student_id } = req.query;

    let query = supabase.from("BOOKING").select(`
      *,
      ROOM (room_number, hostel_id, HOSTEL (hostel_name)),
      USERS:student_id (email, profile_complete)
    `);

    if (req.user.user_type === "STUDENT") {
      // Students can only see their own bookings
      query = query.eq("student_id", req.user.id);
    } else if (student_id) {
      // Managers/Admins can filter by student_id
      query = query.eq("student_id", student_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/bookings/:id
export const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("BOOKING")
      .select(`
        *,
        ROOM (room_number, hostel_id, HOSTEL (hostel_name, manager_id)),
        USERS:student_id (email, profile_complete)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // A booking belongs to the student who made it and the manager of its
    // hostel — anyone else authenticated shouldn't be able to view it by id.
    if (req.user.user_type === "STUDENT" && data.student_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this booking" });
    }
    if (req.user.user_type === "HOSTEL_MANAGER" && data.ROOM?.HOSTEL?.manager_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not manage the hostel for this booking" });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/bookings
export const createBooking = async (req, res, next) => {
  try {
    const { check_in_date, check_out_date, room_id, student_id } = req.body;

    // Check room availability
    const { data: room, error: roomError } = await supabase
      .from("ROOM")
      .select("is_available")
      .eq("id", room_id)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    if (!room.is_available) {
      return res.status(400).json({ success: false, message: "Room is fully occupied and not available for booking" });
    }

    // Force student_id to be the authenticated user's ID if role is STUDENT
    // Otherwise allow Manager/Admin to specify student_id
    const final_student_id = req.user.user_type === "STUDENT" ? req.user.id : student_id;

    const payload = {
      check_in_date,
      check_out_date,
      room_id,
      student_id: final_student_id,
      status: "PENDING",
      created_at: new Date(),
      updated_at: new Date()
    };

    const { data, error } = await supabase
      .from("BOOKING")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/bookings/:id
export const updateBookingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Fetch booking details including room and hostel to verify ownership
    const { data: booking, error: fetchError } = await supabase
      .from("BOOKING")
      .select(`
        *,
        ROOM (
          id,
          capacity,
          current_occupancy,
          hostel_id,
          HOSTEL (
            manager_id
          )
        )
      `)
      .eq("id", id)
      .single();

    if (fetchError || !booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Role-based authorization
    if (req.user.user_type === "STUDENT") {
      if (booking.student_id !== req.user.id) {
        return res.status(403).json({ success: false, message: "Forbidden: You do not own this booking" });
      }
      if (status !== "CANCELLED") {
        return res.status(403).json({ success: false, message: "Students can only cancel their bookings" });
      }
    } else if (req.user.user_type === "HOSTEL_MANAGER") {
      const managerId = booking.ROOM?.HOSTEL?.manager_id;
      if (managerId !== req.user.id) {
        return res.status(403).json({ success: false, message: "Forbidden: You do not manage the hostel for this booking" });
      }
    }

    // Handle Occupancy Changes
    const previousStatus = booking.status;
    const newStatus = status;
    const roomId = booking.room_id;
    let occupancyChange = 0;

    // From non-confirmed to CONFIRMED
    if (newStatus === "CONFIRMED" && previousStatus !== "CONFIRMED") {
      occupancyChange = 1;
    }
    // From CONFIRMED to CANCELLED/CHECKED_OUT
    else if (previousStatus === "CONFIRMED" && (newStatus === "CANCELLED" || newStatus === "CHECKED_OUT")) {
      occupancyChange = -1;
    }

    // Reject confirming into a room that's already at capacity — without this,
    // a manager confirming multiple PENDING bookings for the same room can
    // push current_occupancy above capacity with nothing to stop it.
    if (occupancyChange === 1 && booking.ROOM) {
      const nextOccupancy = (booking.ROOM.current_occupancy || 0) + 1;
      if (nextOccupancy > booking.ROOM.capacity) {
        return res.status(409).json({ success: false, message: "Room is already at full capacity" });
      }
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from("BOOKING")
      .update({ status, updated_at: new Date() })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    if (occupancyChange !== 0 && booking.ROOM) {
      const newOccupancy = Math.max(0, (booking.ROOM.current_occupancy || 0) + occupancyChange);

      await supabase
        .from("ROOM")
        .update({ current_occupancy: newOccupancy })
        .eq("id", roomId);

      await syncRoomAvailability(roomId);
    }

    res.json({ success: true, data: updatedBooking });
  } catch (err) {
    next(err);
  }
};
