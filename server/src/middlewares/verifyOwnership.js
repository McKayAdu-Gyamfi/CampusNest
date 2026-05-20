import { convex } from "../config/db.js";

export const verifyHostelOwnership = async (req, res, next) => {
  try {
    const hostelId = req.params.hostelId || req.params.id;
    const userId = req.user.id;

    const hostel = await convex.query("hostels:getById", { id: hostelId });

    if (!hostel) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }

    if (hostel.manager_id !== userId && req.user.user_type !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this hostel" });
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const verifyRoomOwnership = async (req, res, next) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;

    const room = await convex.query("rooms:getById", { id: roomId });

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    const hostelId = room.hostel_id;
    const hostel = await convex.query("hostels:getById", { id: hostelId });

    if (!hostel) {
      return res.status(404).json({ success: false, message: "Associated hostel not found" });
    }

    if (hostel.manager_id !== userId && req.user.user_type !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own the hostel for this room" });
    }

    next();
  } catch (error) {
    next(error);
  }
};
