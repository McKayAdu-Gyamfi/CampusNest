import { z } from "zod";

export const createBookingSchema = z.object({
  body: z.object({
    check_in_date: z.string().datetime(),
    check_out_date: z.string().datetime(),
    room_id: z.string().min(1, "Room ID is required"),
    // Students are forced to their own id by the controller, so only
    // managers/admins need to send it.
    student_id: z.string().optional(),
    // Paystack transaction reference; verified server-side before booking.
    payment_reference: z.string().optional()
  })
});

export const updateBookingSchema = z.object({
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "CHECKED_OUT"])
  })
});
