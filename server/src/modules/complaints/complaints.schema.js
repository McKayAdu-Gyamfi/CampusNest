import { z } from "zod";

export const createComplaintSchema = z.object({
  body: z.object({
    content: z.string().trim().min(1, "Message is required").max(2000),
    // Ignored for students (always the signed-in user); required for managers/admins.
    student_id: z.string().optional(),
    hostel_id: z.string().min(1, "Hostel ID is required"),
    kind: z.enum(["COMPLAINT", "ENQUIRY"]).optional(),
    subject: z.string().trim().max(120).optional(),
    booking_id: z.string().optional()
  })
});

export const updateComplaintSchema = z.object({
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
    reply: z.string().trim().min(1).max(2000).optional()
  }).refine((b) => b.status || b.reply, { message: "Provide a status or a reply" })
});
