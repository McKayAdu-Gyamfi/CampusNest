import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";
import { verifyTransaction } from "../payments/payments.routes.js";
import { emailBookingCreated, emailBookingDecision } from "../../emails/events.js";

// GET /api/bookings?student_id=123
export const getBookings = async (req, res, next) => {
  try {
    const { student_id } = req.query;

    const args = {};
    if (req.user.user_type === "STUDENT") {
      // Students can only see their own bookings
      args.studentId = req.user.id;
    } else if (student_id) {
      // Managers/Admins can filter by student_id
      args.studentId = String(student_id);
    }

    // A manager is scoped to the rooms of the hostels they manage, the way
    // getBookingById checks ROOM.HOSTEL.manager_id for a single row. This
    // composes with any studentId filter above; ADMIN stays unscoped.
    if (req.user.user_type === "HOSTEL_MANAGER") {
      args.managerId = req.user.id;
    }

    const data = await cq(api.bookings.list, args);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/bookings/:id
export const getBookingById = async (req, res, next) => {
  try {
    const data = await cq(api.bookings.getByIdWithRelations, { id: req.params.id });

    if (!data) {
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
    const { check_in_date, check_out_date, room_id, student_id, payment_reference } = req.body;

    const room = await cq(api.rooms.getBasics, { id: room_id });

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    if (!room.is_available) {
      return res.status(400).json({ success: false, message: "Room is fully occupied and not available for booking" });
    }

    // Force student_id to be the authenticated user's ID if role is STUDENT
    // Otherwise allow Manager/Admin to specify student_id
    const final_student_id = req.user.user_type === "STUDENT" ? req.user.id : student_id;

    if (!final_student_id) {
      return res.status(400).json({ success: false, message: "student_id is required" });
    }

    // A student's booking is only created for a payment Paystack confirms:
    // successful, made by this user, and not already used for another booking.
    let amount_paid;
    if (req.user.user_type === "STUDENT") {
      if (!payment_reference) {
        return res.status(402).json({ success: false, message: "A completed payment is required to book a room" });
      }
      const tx = await verifyTransaction(payment_reference);
      if (tx.status !== "success" || (tx.user_id && tx.user_id !== req.user.id)) {
        return res.status(402).json({ success: false, message: "Payment could not be verified" });
      }
      amount_paid = tx.amount;
    }

    const data = await cm(api.bookings.create, {
      data: { check_in_date, check_out_date, room_id, student_id: final_student_id, payment_reference, amount_paid },
    });

    // Receipt for the student and a heads-up for the manager; never blocks the response.
    void emailBookingCreated(data.id);

    res.status(201).json({ success: true, data });
  } catch (err) {
    if (err.data?.code === "DUPLICATE_PAYMENT") {
      return res.status(409).json({ success: false, message: "This payment has already been used for a booking" });
    }
    if (err.data?.code === "MAINTENANCE_MODE") {
      return res.status(503).json({
        success: false,
        message: "Bookings are temporarily paused for maintenance. Please try again later.",
      });
    }
    next(err);
  }
};

// PATCH /api/bookings/:id
export const updateBookingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const booking = await cq(api.bookings.getByIdWithRelations, { id });

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
      if (booking.ROOM?.HOSTEL?.manager_id !== req.user.id) {
        return res.status(403).json({ success: false, message: "Forbidden: You do not manage the hostel for this booking" });
      }
    }

    // The status change, the occupancy delta, the room's availability, the
    // hostel's available_rooms and the student's current_room_id all move
    // together inside this one mutation.
    let data;
    try {
      data = await cm(api.bookings.updateStatus, { id, status, byStudent: req.user.user_type === "STUDENT" });
    } catch (err) {
      // err.data.code, not err.message — Convex redacts a plain Error's
      // message on a prod deployment, so matching on text would pass in
      // dev and silently fall through to a generic 500 in production.
      if (err.data?.code === "ROOM_AT_CAPACITY") {
        return res.status(409).json({ success: false, message: "Room is already at full capacity" });
      }
      throw err;
    }

    if (!data) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Tell the student when the manager approves or declines (not for their own cancellation).
    void emailBookingDecision(id, { status, previous: booking.status, byStudent: req.user.user_type === "STUDENT" });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
