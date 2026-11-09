import { describe, it, expect, vi, beforeEach } from "vitest";

const cqMock = vi.hoisted(() => vi.fn());
const cmMock = vi.hoisted(() => vi.fn());
const verifyMock = vi.hoisted(() => vi.fn());
const signUpMock = vi.hoisted(() => vi.fn());
const events = vi.hoisted(() => ({
  emailWelcome: vi.fn(),
  emailBookingCreated: vi.fn(),
  emailBookingDecision: vi.fn(),
  emailEnquiryReply: vi.fn(),
}));

vi.mock("../src/config/convexClient.js", () => ({ cq: cqMock, cm: cmMock, ca: vi.fn() }));
vi.mock("../src/modules/payments/payments.routes.js", () => ({ verifyTransaction: verifyMock, default: {} }));
vi.mock("../src/emails/events.js", () => events);
vi.mock("../auth.js", () => ({ auth: { api: { signUpEmail: signUpMock } } }));

import { createBooking, updateBookingStatus } from "../src/modules/bookings/bookings.controller.js";
import { updateComplaintStatus } from "../src/modules/complaints/complaints.controller.js";
import { registerManager, signUp } from "../src/modules/auth/auth.controller.js";

const makeRes = () => {
  const res = { headers: [] };
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.append = vi.fn();
  return res;
};
const student = { id: "u1", user_type: "STUDENT" };
const manager = { id: "m1", user_type: "HOSTEL_MANAGER" };

beforeEach(() => {
  [cqMock, cmMock, verifyMock, signUpMock, ...Object.values(events)].forEach((m) => m.mockReset());
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("booking emails are triggered by the controller", () => {
  const body = { room_id: "r1", check_in_date: 1, check_out_date: 2, payment_reference: "KC-1" };

  it("a paid booking sends the receipt emails after it is created", async () => {
    cqMock.mockResolvedValue({ is_available: true });
    verifyMock.mockResolvedValue({ status: "success", amount: 1500, user_id: "u1" });
    cmMock.mockResolvedValue({ id: "bk1" });
    const res = makeRes();
    await createBooking({ user: student, body }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(events.emailBookingCreated).toHaveBeenCalledWith("bk1");
  });

  it("no email when the booking is refused (duplicate payment)", async () => {
    cqMock.mockResolvedValue({ is_available: true });
    verifyMock.mockResolvedValue({ status: "success", amount: 1500, user_id: "u1" });
    cmMock.mockRejectedValue(Object.assign(new Error("dup"), { data: { code: "DUPLICATE_PAYMENT" } }));
    const res = makeRes();
    await createBooking({ user: student, body }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(events.emailBookingCreated).not.toHaveBeenCalled();
  });

  it("no email when the payment can't be verified", async () => {
    cqMock.mockResolvedValue({ is_available: true });
    verifyMock.mockResolvedValue({ status: "failed", amount: 0, user_id: "u1" });
    const res = makeRes();
    await createBooking({ user: student, body }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(402);
    expect(events.emailBookingCreated).not.toHaveBeenCalled();
  });

  it("a manager's decision is passed on with the previous status", async () => {
    cqMock.mockResolvedValue({ id: "b1", status: "PENDING", student_id: "u1", ROOM: { HOSTEL: { manager_id: "m1" } } });
    cmMock.mockResolvedValue({ id: "b1", status: "CONFIRMED" });
    const res = makeRes();
    await updateBookingStatus({ user: manager, params: { id: "b1" }, body: { status: "CONFIRMED" } }, res, vi.fn());
    expect(events.emailBookingDecision).toHaveBeenCalledWith("b1", { status: "CONFIRMED", previous: "PENDING", byStudent: false });
  });

  it("a student's own cancellation is flagged so the student isn't emailed", async () => {
    cqMock.mockResolvedValue({ id: "b1", status: "PENDING", student_id: "u1", ROOM: { HOSTEL: { manager_id: "m1" } } });
    cmMock.mockResolvedValue({ id: "b1", status: "CANCELLED" });
    await updateBookingStatus({ user: student, params: { id: "b1" }, body: { status: "CANCELLED" } }, makeRes(), vi.fn());
    expect(events.emailBookingDecision).toHaveBeenCalledWith("b1", { status: "CANCELLED", previous: "PENDING", byStudent: true });
  });

  it("no decision email for a manager who doesn't own the booking", async () => {
    cqMock.mockResolvedValue({ id: "b1", status: "PENDING", student_id: "u1", ROOM: { HOSTEL: { manager_id: "someone-else" } } });
    const res = makeRes();
    await updateBookingStatus({ user: manager, params: { id: "b1" }, body: { status: "CONFIRMED" } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(events.emailBookingDecision).not.toHaveBeenCalled();
  });
});

describe("enquiry reply emails", () => {
  const complaint = { id: "c1", student_id: "u1", hostel_id: "h1", hostel_manager_id: "m1", kind: "ENQUIRY", content: "Water?" };

  it("emails the reply once it is saved", async () => {
    cqMock.mockResolvedValue(complaint);
    cmMock.mockResolvedValue({ id: "c1" });
    await updateComplaintStatus({ user: manager, params: { id: "c1" }, body: { status: "RESOLVED", reply: "Yes." } }, makeRes(), vi.fn());
    expect(events.emailEnquiryReply).toHaveBeenCalledWith(complaint, "Yes.");
  });

  it("a status change with no reply sends nothing", async () => {
    cqMock.mockResolvedValue(complaint);
    cmMock.mockResolvedValue({ id: "c1" });
    await updateComplaintStatus({ user: manager, params: { id: "c1" }, body: { status: "IN_PROGRESS" } }, makeRes(), vi.fn());
    await updateComplaintStatus({ user: manager, params: { id: "c1" }, body: { reply: "   " } }, makeRes(), vi.fn());
    expect(events.emailEnquiryReply).not.toHaveBeenCalled();
  });

  it("a manager who doesn't own the complaint can't trigger an email", async () => {
    cqMock.mockResolvedValue(complaint);
    const res = makeRes();
    await updateComplaintStatus({ user: { id: "other", user_type: "HOSTEL_MANAGER" }, params: { id: "c1" }, body: { reply: "Hi" } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(events.emailEnquiryReply).not.toHaveBeenCalled();
  });
});

describe("welcome emails", () => {
  const authResponse = (status, json) => ({ status, headers: { forEach: () => {} }, json: async () => json });

  it("a student sign-up sends the student welcome", async () => {
    signUpMock.mockResolvedValue(authResponse(200, { user: { id: "u1", name: "Ama Boateng", email: "ama@ashesi.edu.gh" } }));
    await signUp({ body: { email: "ama@ashesi.edu.gh", password: "longenough1", name: "Ama Boateng" } }, makeRes(), vi.fn());
    expect(events.emailWelcome).toHaveBeenCalledWith({ name: "Ama Boateng", email: "ama@ashesi.edu.gh" }, "student");
  });

  it("a failed sign-up (e.g. email already used) sends nothing", async () => {
    signUpMock.mockResolvedValue(authResponse(422, { message: "User already exists" }));
    await signUp({ body: { email: "ama@ashesi.edu.gh", password: "longenough1" } }, makeRes(), vi.fn());
    expect(events.emailWelcome).not.toHaveBeenCalled();
  });

  it("a manager registration sends the manager welcome", async () => {
    signUpMock.mockResolvedValue({ user: { id: "m1", name: "Kwame", email: "kwame@example.com" } });
    cmMock.mockResolvedValue({ id: "m1", name: "Kwame", email: "kwame@example.com" });
    await registerManager({ body: { email: "kwame@example.com", password: "longenough1", user_type: "HOSTEL_MANAGER", name: "Kwame" } }, makeRes(), vi.fn());
    expect(events.emailWelcome).toHaveBeenCalledWith({ name: "Kwame", email: "kwame@example.com" }, "manager");
  });
});
