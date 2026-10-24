import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";

// GET /api/complaints
export const getComplaints = async (req, res, next) => {
  try {
    const { hostel_id, student_id } = req.query;

    const args = {};
    if (req.user.user_type === "STUDENT") {
      // Students can only ever see their own complaints, regardless of
      // whatever student_id they pass in the query string.
      args.studentId = req.user.id;
    } else {
      if (student_id) args.studentId = String(student_id);
      if (req.user.user_type === "HOSTEL_MANAGER") {
        // Managers only see complaints for hostels they manage.
        args.hostelManagerId = req.user.id;
      }
    }

    if (hostel_id) args.hostelId = String(hostel_id);

    const data = await cq(api.complaints.list, args);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/complaints/:id
export const getComplaintById = async (req, res, next) => {
  try {
    const data = await cq(api.complaints.getByIdWithUser, { id: req.params.id });

    if (!data) {
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

    const hostel = await cq(api.hostels.getManagerId, { id: hostel_id });

    if (!hostel) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }

    if (req.user.user_type === "STUDENT") {
      // A student can only complain about a hostel they've actually booked.
      const roomIds = await cq(api.rooms.listIdsByHostel, { hostelId: hostel_id });
      const hasBooked = await cq(api.bookings.existsForStudentInRooms, {
        studentId: req.user.id,
        roomIds,
      });

      if (!hasBooked) {
        return res.status(403).json({ success: false, message: "You can only file a complaint about a hostel you've booked" });
      }
    }

    const data = await cm(api.complaints.create, {
      data: {
        ...req.body,
        // A student can only ever file a complaint as themselves, never on
        // behalf of another student_id passed in the body.
        student_id: req.user.user_type === "STUDENT" ? req.user.id : req.body.student_id,
        hostel_manager_id: hostel.manager_id,
      },
    });

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

    const complaint = await cq(api.complaints.getByIdWithUser, { id });

    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    // Only the manager of the hostel this complaint was filed against (or
    // an admin) can change its status.
    if (req.user.user_type !== "ADMIN" && complaint.hostel_manager_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not manage the hostel for this complaint" });
    }

    const data = await cm(api.complaints.updateStatus, { id, status });

    if (!data) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
