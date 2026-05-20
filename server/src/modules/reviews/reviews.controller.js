import { convex } from "../../config/db.js";

// GET /api/reviews?hostel_id=123
export const getReviews = async (req, res, next) => {
  try {
    const { hostel_id } = req.query;

    const data = await convex.query("reviews:list", { 
      hostel_id: hostel_id || undefined 
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/reviews
export const createReview = async (req, res, next) => {
  try {
    const data = await convex.mutation("reviews:create", req.body);

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
