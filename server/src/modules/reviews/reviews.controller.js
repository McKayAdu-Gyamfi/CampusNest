import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";

// GET /api/reviews?hostel_id=123
export const getReviews = async (req, res, next) => {
  try {
    const { hostel_id } = req.query;
    const args = {};
    if (hostel_id) args.hostelId = String(hostel_id);

    const data = await cq(api.reviews.listByHostel, args);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/reviews/:id   (admin moderation)
export const removeReview = async (req, res, next) => {
  try {
    const ok = await cm(api.reviews.remove, { id: req.params.id, actorId: req.user.id, reason: req.body?.reason });
    if (!ok) return res.status(404).json({ success: false, message: "Review not found" });
    res.json({ success: true });
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
    const roomIds = await cq(api.rooms.listIdsByHostel, { hostelId: hostel_id });

    const hasStayed = await cq(api.bookings.existsForStudentInRooms, {
      studentId: req.user.id,
      roomIds,
      statuses: ["CONFIRMED", "CHECKED_OUT"],
    });

    if (!hasStayed) {
      return res.status(403).json({ success: false, message: "You can only review a hostel you've booked and stayed at" });
    }

    const data = await cm(api.reviews.create, {
      // One review per student per hostel: a second submission edits the first.
      data: { ...req.body, student_id: req.user.id, replace_existing: true },
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
