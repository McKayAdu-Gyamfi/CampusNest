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
    total_rooms: z.number().int().min(1).default(1),
    available_rooms: z.number().int().min(0).default(0),
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
    total_rooms: z.number().int().optional(),
    available_rooms: z.number().int().min(0).optional(),
    distance_from_campus: z.number().nonnegative().optional(),
    // status and manager_id are deliberately not accepted here — see
    // updateHostelStatusSchema below and hostels.controller.js.
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
