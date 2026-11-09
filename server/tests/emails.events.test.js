import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFunctionName } from "convex/server";

const cqMock = vi.hoisted(() => vi.fn());
const sendMailMock = vi.hoisted(() => vi.fn());
vi.mock("../src/config/convexClient.js", () => ({ cq: cqMock, cm: vi.fn(), ca: vi.fn() }));
vi.mock("../src/utils/mailer.js", () => ({ sendMail: sendMailMock }));

import { emailBookingCreated, emailBookingDecision, emailEnquiryReply, emailWelcome } from "../src/emails/events.js";

const bookingRow = {
  id: "bk1",
  student_id: "s1",
  check_in_date: "2027-01-12T00:00:00.000Z",
  check_out_date: "2027-06-30T00:00:00.000Z",
  amount_paid: 1500,
  payment_reference: "KC-AB12CD34",
  USERS: { email: "ama@ashesi.edu.gh", name: "Ama Boateng" },
  ROOM: { room_number: "305", room_type: "TWO_IN_A_ROOM", HOSTEL: { hostel_name: "Dufie Annex", manager_id: "m1" } },
};

const users = {
  s1: { id: "s1", email: "ama@ashesi.edu.gh", name: "Ama Boateng" },
  m1: { id: "m1", email: "kwame@example.com", name: "Kwame Owusu" },
};

/** Routes each cq call by the function it targets, in whatever order the code makes them. */
function stubConvex({ booking = bookingRow, hostel = { hostel_name: "Dufie Annex" }, userMap = users } = {}) {
  cqMock.mockImplementation(async (fn, args) => {
    const name = getFunctionName(fn);
    if (name === "bookings:getByIdWithRelations") return args.id === booking?.id ? booking : null;
    if (name === "users:findOne") return userMap[args.where[0].value] ?? null;
    if (name === "hostels:getByIdWithRelations") return hostel;
    return null;
  });
}

beforeEach(() => {
  cqMock.mockReset();
  sendMailMock.mockReset().mockResolvedValue({ sent: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("emailWelcome", () => {
  it("sends the student welcome to the new address", async () => {
    await emailWelcome({ name: "Ama", email: "ama@ashesi.edu.gh" }, "student");
    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(sendMailMock.mock.calls[0][0]).toMatchObject({ to: "ama@ashesi.edu.gh", subject: "Welcome to KayaCampus, Ama" });
  });

  it("sends the manager version for managers", async () => {
    await emailWelcome({ name: "Kwame", email: "kwame@example.com" }, "manager");
    expect(sendMailMock.mock.calls[0][0].text).toContain("Add your property");
  });

  it("never throws when the mail server fails", async () => {
    sendMailMock.mockRejectedValue(new Error("SMTP down"));
    await expect(emailWelcome({ name: "Ama", email: "a@b.com" }, "student")).resolves.toEqual({ sent: false });
  });
});

describe("emailBookingCreated", () => {
  it("sends the student a receipt and the manager a request", async () => {
    stubConvex();
    await emailBookingCreated("bk1");
    const sent = sendMailMock.mock.calls.map((c) => c[0]);
    expect(sent).toHaveLength(2);
    expect(sent.find((m) => m.to === "ama@ashesi.edu.gh").subject).toBe("Payment received: GHS 1,500.00 · Dufie Annex");
    expect(sent.find((m) => m.to === "kwame@example.com").subject).toBe("New booking request from Ama Boateng · Dufie Annex");
  });

  it("skips a suspended student but still tells the manager", async () => {
    stubConvex({ userMap: { ...users, s1: { ...users.s1, suspended_at: "2026-11-01T00:00:00.000Z" } } });
    await emailBookingCreated("bk1");
    expect(sendMailMock.mock.calls.map((c) => c[0].to)).toEqual(["kwame@example.com"]);
  });

  it("skips the manager email when the hostel has no manager", async () => {
    stubConvex({ booking: { ...bookingRow, ROOM: { ...bookingRow.ROOM, HOSTEL: { hostel_name: "Dufie Annex", manager_id: null } } } });
    await emailBookingCreated("bk1");
    expect(sendMailMock.mock.calls.map((c) => c[0].to)).toEqual(["ama@ashesi.edu.gh"]);
  });

  it("does nothing, quietly, when the booking can't be found or Convex fails", async () => {
    cqMock.mockResolvedValue(null);
    await expect(emailBookingCreated("nope")).resolves.toBeUndefined();
    cqMock.mockRejectedValue(new Error("convex down"));
    await expect(emailBookingCreated("bk1")).resolves.toBeUndefined();
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

describe("emailBookingDecision", () => {
  it("emails the student when the manager approves", async () => {
    stubConvex();
    await emailBookingDecision("bk1", { status: "CONFIRMED", previous: "PENDING", byStudent: false });
    expect(sendMailMock.mock.calls[0][0]).toMatchObject({ to: "ama@ashesi.edu.gh", subject: "Your booking at Dufie Annex is approved" });
  });

  it("says declined for a pending request and cancelled for an approved one", async () => {
    stubConvex();
    await emailBookingDecision("bk1", { status: "CANCELLED", previous: "PENDING", byStudent: false });
    await emailBookingDecision("bk1", { status: "CANCELLED", previous: "CONFIRMED", byStudent: false });
    expect(sendMailMock.mock.calls.map((c) => c[0].subject)).toEqual(["Your booking at Dufie Annex was declined", "Your booking at Dufie Annex was cancelled"]);
  });

  it("stays quiet for the student's own cancellation, no-op changes and other statuses", async () => {
    stubConvex();
    await emailBookingDecision("bk1", { status: "CANCELLED", previous: "PENDING", byStudent: true });
    await emailBookingDecision("bk1", { status: "CONFIRMED", previous: "CONFIRMED", byStudent: false });
    await emailBookingDecision("bk1", { status: "CHECKED_OUT", previous: "CONFIRMED", byStudent: false });
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

describe("emailEnquiryReply", () => {
  const complaint = { student_id: "s1", hostel_id: "h1", kind: "ENQUIRY", subject: "Water", content: "Is there running water?", booking_id: "bk1" };

  it("emails the student the manager's reply", async () => {
    stubConvex();
    await emailEnquiryReply(complaint, "  Yes, 24 hours.  ");
    const m = sendMailMock.mock.calls[0][0];
    expect(m).toMatchObject({ to: "ama@ashesi.edu.gh", subject: "Dufie Annex replied to your enquiry" });
    expect(m.text).toContain('"Yes, 24 hours."');
  });

  it("sends nothing for an empty reply", async () => {
    stubConvex();
    await emailEnquiryReply(complaint, "   ");
    await emailEnquiryReply(complaint, undefined);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
