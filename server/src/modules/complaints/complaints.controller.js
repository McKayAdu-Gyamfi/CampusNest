import { convex } from "../../config/db.js";

// GET /api/complaints
export const getComplaints = async (req, res, next) => {
  try {
    const { hostel_id, student_id } = req.query;

    const data = await convex.query("complaints:list", { 
      hostel_id: hostel_id || undefined,
      student_id: student_id || undefined
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/complaints/:id
export const getComplaintById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const data = await convex.query("complaints:getById", { id });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/complaints
export const createComplaint = async (req, res, next) => {
  try {
    const data = await convex.mutation("complaints:create", req.body);
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

    const data = await convex.mutation("complaints:updateStatus", { id, status });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
