import { z } from "zod";

// Optional free-text profile fields. Empty string clears the value.
const text = (max = 120) => z.string().trim().max(max).optional();
const phone = z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number").or(z.literal("")).optional();
export const profileFields = {
  phone,
  institution: text(), level: text(20), gender: z.enum(["Female", "Male", "Other", ""]).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").or(z.literal("")).optional(),
  emergency_contact_name: text(), emergency_contact_phone: phone,
  business_name: text(), ghana_card_number: text(30),
  payout_method: z.enum(["momo", "bank"]).optional(),
  momo_network: text(30), momo_number: phone,
  bank_name: text(), bank_account_number: z.string().trim().regex(/^\d{6,20}$/, "Account number must be digits").or(z.literal("")).optional(),
  bank_account_name: text(),
};

export const updateUserProfileSchema = z.object({
  body: z.object({
    course: z.string().optional(),
    // current_room_id is intentionally NOT user-settable here — it's only
    // ever assigned by the system when a booking is confirmed (see
    // bookings.controller.js). Letting a student set it directly would
    // move them into any room with no booking, approval, or payment.
    student_id: z.string().optional(), // School issued student ID
    name: z.string().optional(), // Common
    payment_details: z.string().optional(), // Manager specific
    ...profileFields,
  })
});

export const completeProfileSchema = z.object({
  body: z.object({
    course: z.string({ required_error: "Course is required" }),
    student_id: z.string({ required_error: "Student ID is required" }),
  })
});

export const completeManagerProfileSchema = z.object({
  body: z.object({
    payment_details: z.string({ required_error: "Payment details are required" })
  })
});

export const createAdminSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().optional()
  })
});

export const adminUpdateUserSchema = z.object({
  body: z.object({
    profile_complete: z.boolean().optional(),
    course: z.string().optional(),
    // current_room_id is not admin-settable either: it is derived from a
    // CONFIRMED booking and written only by bookings.updateStatus (and
    // cleared by rooms.remove). Allowing it here placed a student in a room
    // with no booking, approval, or payment.
    student_id: z.string().optional(),
    user_type: z.enum(["STUDENT", "HOSTEL_MANAGER", "ADMIN"]).optional(),
    name: z.string().optional(),
    payment_details: z.string().optional()
  })
});

export const setSuspensionSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    suspended: z.boolean(),
    reason: z.string().trim().max(300).optional()
  }).refine((b) => !b.suspended || (b.reason && b.reason.length >= 3), {
    message: "Give a short reason when suspending an account",
    path: ["reason"],
  })
});
