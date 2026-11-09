import { cq } from "../config/convexClient.js";
import { api } from "../../convex/_generated/api.js";
import { sendMail } from "../utils/mailer.js";
import {
  bookingApprovedEmail,
  bookingDeclinedEmail,
  bookingRequestManagerEmail,
  bookingRequestStudentEmail,
  enquiryReplyEmail,
  welcomeManagerEmail,
  welcomeStudentEmail,
} from "./templates.js";

// The moments the platform emails someone. Every function here:
//  - is called AFTER the action succeeded, and is meant to be fire-and-forget
//    (`void emailX(...)`): it never throws and never delays the response,
//  - looks up what it needs itself, so a controller only passes ids,
//  - skips recipients who can't or shouldn't be emailed (no address, suspended).

async function deliver(user, template, label) {
  try {
    if (!user?.email) return { sent: false };
    if (user.suspended_at) return { sent: false };
    return await sendMail({ to: user.email, ...template, devNote: `[${label}]\n${template.text}` });
  } catch (err) {
    console.error(`[Email] ${label} to ${user?.email} failed:`, err.message);
    return { sent: false };
  }
}

const userById = (id) => (id ? cq(api.users.findOne, { where: [{ field: "id", value: id }] }) : null);

/** Shape the templates want, from a booking-with-relations row. */
const bookingFacts = (b) => ({
  hostelName: b.ROOM?.HOSTEL?.hostel_name ?? "your hostel",
  roomNumber: b.ROOM?.room_number,
  roomType: b.ROOM?.room_type,
  checkIn: b.check_in_date,
  checkOut: b.check_out_date,
});

// ── Sign-up ──────────────────────────────────────────────────────────────────

/** @param {{ name?: string, email: string }} user  @param {"student" | "manager"} role */
export async function emailWelcome(user, role) {
  try {
    const template = role === "manager" ? welcomeManagerEmail(user) : welcomeStudentEmail(user);
    return await deliver(user, template, `welcome:${role}`);
  } catch (err) {
    console.error("[Email] welcome failed:", err.message);
    return { sent: false };
  }
}

// ── Payment: a booking request was created (students pay first) ─────────────

export async function emailBookingCreated(bookingId) {
  try {
    const booking = await cq(api.bookings.getByIdWithRelations, { id: bookingId });
    if (!booking) return;
    const facts = bookingFacts(booking);
    const student = booking.USERS ?? {};

    // Look the student up for the suspension check; the relations row only has name/email.
    const [studentUser, manager] = await Promise.all([userById(booking.student_id), userById(booking.ROOM?.HOSTEL?.manager_id)]);

    await Promise.all([
      deliver(
        { ...student, suspended_at: studentUser?.suspended_at },
        bookingRequestStudentEmail({ studentName: student.name, booking: facts, amountPaid: booking.amount_paid, reference: booking.payment_reference, bookingId }),
        "booking:receipt",
      ),
      manager
        ? deliver(manager, bookingRequestManagerEmail({ managerName: manager.name, studentName: student.name, booking: facts, amountPaid: booking.amount_paid }), "booking:manager")
        : null,
    ]);
  } catch (err) {
    console.error("[Email] booking created failed:", err.message);
  }
}

// ── Manager decision on a booking ───────────────────────────────────────────

/**
 * @param {string} bookingId
 * @param {{ status: string, previous: string, byStudent: boolean }} change
 */
export async function emailBookingDecision(bookingId, { status, previous, byStudent }) {
  try {
    // Only the manager's (or an admin's) decision is news to the student.
    if (byStudent || status === previous) return;
    if (status !== "CONFIRMED" && status !== "CANCELLED") return;

    const booking = await cq(api.bookings.getByIdWithRelations, { id: bookingId });
    if (!booking) return;
    const student = await userById(booking.student_id);
    if (!student) return;
    const facts = bookingFacts(booking);

    const template = status === "CONFIRMED"
      ? bookingApprovedEmail({ studentName: student.name, booking: facts, bookingId })
      : bookingDeclinedEmail({ studentName: student.name, booking: facts, bookingId, declined: previous === "PENDING" });
    await deliver(student, template, status === "CONFIRMED" ? "booking:approved" : "booking:declined");
  } catch (err) {
    console.error("[Email] booking decision failed:", err.message);
  }
}

// ── Manager answers an enquiry / complaint ──────────────────────────────────

/** @param {object} complaint the row before the update (has student_id, hostel_id, kind, subject, content, booking_id) */
export async function emailEnquiryReply(complaint, reply) {
  try {
    const text = String(reply ?? "").trim();
    if (!text) return;
    const [student, hostel] = await Promise.all([userById(complaint.student_id), cq(api.hostels.getByIdWithRelations, { id: complaint.hostel_id })]);
    if (!student) return;
    await deliver(
      student,
      enquiryReplyEmail({
        studentName: student.name,
        hostelName: hostel?.hostel_name ?? "Your hostel",
        kind: complaint.kind,
        subject: complaint.subject,
        question: complaint.content,
        reply: text,
        bookingId: complaint.booking_id,
        hostelId: complaint.hostel_id,
      }),
      "enquiry:reply",
    );
  } catch (err) {
    console.error("[Email] enquiry reply failed:", err.message);
  }
}
