import { z } from "zod";

export const getHostelSchema = z.object({
  params: z.object({
    id: z.string()
  }).optional()
});

export const createHostelSchema = z.object({
  body: z.object({
    hostel_name: z.string().min(1, "Hostel name is required"),
    location: z.string().min(1, "Location is required"),
    description: z.string().optional(),
    // total_rooms/available_rooms are deliberately not accepted: they are
    // derived from the rooms that exist and are maintained by rooms.create /
    // rooms.remove / bookings.updateStatus. createHostel always sends 0.
    distance_from_campus: z.number().nonnegative().optional(),
    // manager_id relates to Better Auth users table
    manager_id: z.string().optional()
  })
});

export const updateHostelSchema = z.object({
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    hostel_name: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    distance_from_campus: z.number().nonnegative().optional(),
    // status and manager_id are deliberately not accepted here — see
    // updateHostelStatusSchema below and hostels.controller.js.
    // total_rooms and available_rooms are likewise not accepted: they are
    // derived counters owned by rooms.create / rooms.remove /
    // bookings.updateStatus, and updateHostel strips them too.
  })
});

export const updateHostelStatusSchema = z.object({
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"])
  })
});
