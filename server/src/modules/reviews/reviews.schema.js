import { z } from "zod";

export const createReviewSchema = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional(),
    // Ignored: the review is always filed as the signed-in student.
    student_id: z.string().optional(),
    hostel_id: z.string().min(1, "Hostel ID is required")
  })
});
