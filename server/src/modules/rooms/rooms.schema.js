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
    height: z.number().positive().optional(),
    tour_url: z.string().url().optional()
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
    current_occupancy: z.number().int().min(0).optional(),
    length: z.number().positive().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    tour_url: z.string().url().optional()
  })
});
