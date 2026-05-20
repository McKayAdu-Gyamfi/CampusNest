import { convex } from "../../config/db.js";

// GET /api/bookings?student_id=123
export const getBookings = async (req, res, next) => {
  try {
    const { student_id } = req.query;

    let targetStudentId = undefined;
    if (req.user.user_type === "STUDENT") {
      // Students can only see their own bookings
      targetStudentId = req.user.id;
    } else if (student_id) {
      // Managers/Admins can filter by student_id
      targetStudentId = student_id;
    }

    const data = await convex.query("bookings:list", { 
      student_id: targetStudentId 
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/bookings/:id
export const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const data = await convex.query("bookings:getById", { id });
    
    if (!data) {
      return res.status(404).json({ success: false, message: "Booking not found" });
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

    // Force student_id to be the authenticated user's ID if role is STUDENT
    // Otherwise allow Manager/Admin to specify student_id
    const final_student_id = req.user.user_type === "STUDENT" ? req.user.id : student_id;
    
    // Convert dates to timestamp if they aren't already
    const check_in_timestamp = new Date(check_in_date).getTime();
    const check_out_timestamp = new Date(check_out_date).getTime();

    // Convex backend now handles the room availability check
    const data = await convex.mutation("bookings:create", {
      check_in_date: check_in_timestamp,
      check_out_date: check_out_timestamp,
      room_id,
      student_id: final_student_id
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    // If the room is not available, our Convex function throws an error
    if (err.message?.includes("Room is fully occupied")) {
      return res.status(400).json({ success: false, message: "Room is fully occupied and not available for booking" });
    }
    next(err);
  }
};

// PATCH /api/bookings/:id
export const updateBookingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Fetch booking details to verify ownership
    const booking = await convex.query("bookings:getById", { id });

    if (!booking) {
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

    // Convex backend handles the status update and occupancy changes inline
    const updatedBooking = await convex.mutation("bookings:updateStatus", { id, status });

    res.json({ success: true, data: updatedBooking });
  } catch (err) {
    next(err);
  }
};
