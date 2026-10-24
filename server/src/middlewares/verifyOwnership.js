import { supabase } from "../config/db.js";
import { cq } from "../config/convexClient.js";
import { api } from "../../convex/_generated/api.js";

export const verifyHostelOwnership = async (req, res, next) => {
  try {
    const hostelId = req.params.hostelId || req.params.id;
    const userId = req.user.id;

    const hostel = await cq(api.hostels.getManagerId, { id: hostelId });

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

    // Fetch the room to find its associated hostel
    const { data: room, error: roomError } = await supabase
      .from("ROOM")
      .select("hostel_id")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    // Fetch the hostel to check the manager_id
    const { data: hostel, error: hostelError } = await supabase
      .from("HOSTEL")
      .select("manager_id")
      .eq("id", room.hostel_id)
      .single();

    if (hostelError || !hostel) {
      return res.status(404).json({ success: false, message: "Associated hostel not found" });
    }

    // Check ownership or admin status
    if (hostel.manager_id !== userId && req.user.user_type !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own the hostel for this room" });
    }

    next();
  } catch (error) {
    next(error);
  }
};
