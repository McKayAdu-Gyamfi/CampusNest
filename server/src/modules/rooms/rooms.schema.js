import { z } from "zod";

export const createRoomSchema = z.object({
  body: z.object({
    room_number: z.string().min(1, "Room number is required"),
    room_type: z.enum(["SINGLE", "DOUBLE", "TRIPLE", "QUAD"]),
    price_per_bed: z.number().positive(),
    capacity: z.number().int().positive(),
    hostel_id: z.string().min(1, "Hostel ID is required"),
    length: z.number().positive().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional()
    // tour_url is not accepted: it is not a column in convex/schema.ts, so
    // forwarding it to ctx.db.patch makes Convex's strict schema throw an
    // unconditional 500. Tour scenes have their own endpoints
    // (POST /api/rooms/:id/tour-scenes).
  })
});

export const updateRoomSchema = z.object({
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    room_number: z.string().optional(),
    room_type: z.enum(["SINGLE", "DOUBLE", "TRIPLE", "QUAD"]).optional(),
    price_per_bed: z.number().positive().optional(),
    capacity: z.number().int().positive().optional(),
    // current_occupancy is not accepted: it counts exactly the room's
    // CONFIRMED bookings and is written only by bookings.updateStatus.
    // Accepting it let a manager decouple it from the real booking count
    // (and, through rooms.update's re-derivation, from is_available and the
    // hostel's available_rooms).
    length: z.number().positive().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional()
    // tour_url: see createRoomSchema above.
  })
});
