import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

const { cqMock, cmMock, verifyMock, session } = vi.hoisted(() => ({
  cqMock: vi.fn(),
  cmMock: vi.fn(),
  verifyMock: vi.fn(),
  session: { user: null },
}));

vi.mock("../src/config/convexClient.js", () => ({ cq: cqMock, cm: cmMock, ca: vi.fn() }));

// Paystack is never called from tests: verifyTransaction is a controllable fake.
vi.mock("../src/modules/payments/payments.routes.js", async () => {
  const { Router } = await import("express");
  return { default: Router(), verifyTransaction: verifyMock };
});

// Swap the real session lookup for a settable fake user.
vi.mock("../auth.js", () => ({
  auth: {
    api: { getSession: async () => (session.user ? { user: session.user } : null) },
    handler: async () => new Response("{}"),
  },
}));

const { default: app } = await import("../src/app.js");

const as = (user_type) => {
  session.user = user_type ? { id: `${user_type}-id`, user_type } : null;
};

beforeEach(() => {
  cqMock.mockReset();
  cmMock.mockReset();
  verifyMock.mockReset();
  as(null);
});

describe("settings routes", () => {
  it("public settings need no auth and expose only name + maintenance flag", async () => {
    cqMock.mockResolvedValue({ platform_name: "KayaCampus", support_email: "s@x.com", maintenance_mode: true, updated_at: null });
    const res = await request(app).get("/api/settings/public");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ platform_name: "KayaCampus", maintenance_mode: true });
  });

  it("full settings are admin-only", async () => {
    expect((await request(app).get("/api/settings")).status).toBe(401);
    as("HOSTEL_MANAGER");
    expect((await request(app).get("/api/settings")).status).toBe(403);
  });

  it("update strips unknown fields and rejects a bad email", async () => {
    as("ADMIN");
    cmMock.mockResolvedValue({ platform_name: "K" });
    await request(app).patch("/api/settings").send({ platform_name: "K", updated_at: 1, is_admin: true });
    expect(cmMock.mock.calls[0][1]).toEqual({ platform_name: "K", actorId: "ADMIN-id" });

    const bad = await request(app).patch("/api/settings").send({ support_email: "not-an-email" });
    expect(bad.status).toBe(400);
  });
});

describe("schools routes", () => {
  it("are admin-only", async () => {
    as("STUDENT");
    expect((await request(app).get("/api/schools")).status).toBe(403);
  });

  it("maps a duplicate domain to 409", async () => {
    as("ADMIN");
    cmMock.mockRejectedValue(Object.assign(new Error("x"), { data: { code: "DUPLICATE_SCHOOL_DOMAIN" } }));
    const res = await request(app).post("/api/schools").send({ name: "A", location: "B", email_domain: "a.edu" });
    expect(res.status).toBe(409);
  });

  it("passes the school id from the URL when detaching a hostel", async () => {
    as("ADMIN");
    cmMock.mockResolvedValue({ success: true });
    await request(app).delete("/api/schools/school-1/hostels/hostel-9");
    expect(cmMock.mock.calls[0][1]).toEqual({ schoolId: "school-1", hostelId: "hostel-9" });
  });
});

describe("stats routes", () => {
  it("manager stats are scoped to the signed-in manager, never a query param", async () => {
    as("HOSTEL_MANAGER");
    cqMock.mockResolvedValue({});
    await request(app).get("/api/stats/manager?managerId=someone-else");
    expect(cqMock.mock.calls[0][1]).toEqual({ managerId: "HOSTEL_MANAGER-id" });
  });

  it("admin stats reject managers", async () => {
    as("HOSTEL_MANAGER");
    expect((await request(app).get("/api/stats/admin")).status).toBe(403);
  });
});

const bookingBody = {
  room_id: "room-1", check_in_date: "2026-11-01T00:00:00Z", check_out_date: "2027-05-01T00:00:00Z",
};
const asStudentWithRoom = () => {
  as("STUDENT");
  cqMock
    .mockResolvedValueOnce({ profile_complete: true }) // requireCompleteProfile
    .mockResolvedValueOnce({ id: "room-1", is_available: true }); // rooms.getBasics
};

describe("booking creation", () => {
  it("maps MAINTENANCE_MODE to 503", async () => {
    asStudentWithRoom();
    verifyMock.mockResolvedValue({ status: "success", amount: 7000, user_id: "STUDENT-id" });
    cmMock.mockRejectedValue(Object.assign(new Error("x"), { data: { code: "MAINTENANCE_MODE" } }));
    const res = await request(app).post("/api/bookings").send({ ...bookingBody, payment_reference: "KC-1" });
    expect(res.status).toBe(503);
  });

  it("requires a payment reference from students", async () => {
    asStudentWithRoom();
    const res = await request(app).post("/api/bookings").send(bookingBody);
    expect(res.status).toBe(402);
    expect(cmMock).not.toHaveBeenCalled();
  });

  it("rejects a payment Paystack did not confirm, or one made by someone else", async () => {
    asStudentWithRoom();
    verifyMock.mockResolvedValue({ status: "abandoned", amount: 7000, user_id: "STUDENT-id" });
    expect((await request(app).post("/api/bookings").send({ ...bookingBody, payment_reference: "KC-1" })).status).toBe(402);

    asStudentWithRoom();
    verifyMock.mockResolvedValue({ status: "success", amount: 7000, user_id: "someone-else" });
    expect((await request(app).post("/api/bookings").send({ ...bookingBody, payment_reference: "KC-2" })).status).toBe(402);
    expect(cmMock).not.toHaveBeenCalled();
  });

  it("stores the verified amount and reference, and maps a reused payment to 409", async () => {
    asStudentWithRoom();
    verifyMock.mockResolvedValue({ status: "success", amount: 8500, user_id: "STUDENT-id" });
    cmMock.mockResolvedValueOnce({ id: "b1" });
    const ok = await request(app).post("/api/bookings").send({ ...bookingBody, payment_reference: "KC-3" });
    expect(ok.status).toBe(201);
    expect(cmMock.mock.calls[0][1].data).toMatchObject({ payment_reference: "KC-3", amount_paid: 8500, student_id: "STUDENT-id" });

    asStudentWithRoom();
    cmMock.mockRejectedValueOnce(Object.assign(new Error("x"), { data: { code: "DUPLICATE_PAYMENT" } }));
    const dup = await request(app).post("/api/bookings").send({ ...bookingBody, payment_reference: "KC-3" });
    expect(dup.status).toBe(409);
  });
});

describe("notifications routes", () => {
  it("require auth and are scoped to the signed-in user", async () => {
    expect((await request(app).get("/api/notifications")).status).toBe(401);
    as("HOSTEL_MANAGER");
    cqMock.mockResolvedValue([]);
    await request(app).get("/api/notifications?userId=someone-else");
    expect(cqMock.mock.calls[0][1]).toMatchObject({ userId: "HOSTEL_MANAGER-id" });
  });
});

describe("complaints routes", () => {
  it("a student's message always carries their own id, plus the new kind/subject fields", async () => {
    as("STUDENT");
    cqMock
      .mockResolvedValueOnce({ manager_id: "mgr-1" }) // hostels.getManagerId
      .mockResolvedValueOnce(["room-1"]) // rooms.listIdsByHostel
      .mockResolvedValueOnce(true); // bookings.existsForStudentInRooms
    cmMock.mockResolvedValueOnce({ id: "c1" });
    const res = await request(app).post("/api/complaints").send({
      hostel_id: "h1", kind: "ENQUIRY", subject: "Parking", content: "Is parking included?", student_id: "someone-else",
    });
    expect(res.status).toBe(201);
    expect(cmMock.mock.calls[0][1].data).toMatchObject({
      student_id: "STUDENT-id", hostel_manager_id: "mgr-1", kind: "ENQUIRY", subject: "Parking",
    });
  });

  it("rejects an empty message and a student with no booking at that hostel", async () => {
    as("STUDENT");
    expect((await request(app).post("/api/complaints").send({ hostel_id: "h1", content: "   " })).status).toBe(400);
    cqMock.mockResolvedValueOnce({ manager_id: "m" }).mockResolvedValueOnce([]).mockResolvedValueOnce(false);
    expect((await request(app).post("/api/complaints").send({ hostel_id: "h1", content: "hi" })).status).toBe(403);
    expect(cmMock).not.toHaveBeenCalled();
  });

  it("only the hostel's own manager can reply", async () => {
    as("HOSTEL_MANAGER");
    cqMock.mockResolvedValueOnce({ id: "c1", hostel_manager_id: "someone-else" });
    expect((await request(app).patch("/api/complaints/c1").send({ reply: "ok" })).status).toBe(403);

    cqMock.mockResolvedValueOnce({ id: "c1", hostel_manager_id: "HOSTEL_MANAGER-id" });
    cmMock.mockResolvedValueOnce({ id: "c1", reply: "ok" });
    const ok = await request(app).patch("/api/complaints/c1").send({ reply: "ok", status: "RESOLVED" });
    expect(ok.status).toBe(200);
    expect(cmMock.mock.calls[0][1]).toMatchObject({ id: "c1", reply: "ok", status: "RESOLVED" });
  });

  it("a student cannot reply or change status", async () => {
    as("STUDENT");
    cqMock.mockResolvedValueOnce({ id: "c1", hostel_manager_id: "m" });
    expect((await request(app).patch("/api/complaints/c1").send({ status: "RESOLVED" })).status).toBe(403);
  });

  it("needs a status or a reply", async () => {
    as("HOSTEL_MANAGER");
    expect((await request(app).patch("/api/complaints/c1").send({})).status).toBe(400);
  });
});

describe("hostel photos are admin-only", () => {
  it("a manager cannot add or remove photos, even on their own hostel", async () => {
    as("HOSTEL_MANAGER");
    expect((await request(app).post("/api/hostels/h1/images")).status).toBe(403);
    expect((await request(app).delete("/api/hostels/h1/images/i1")).status).toBe(403);
    expect(cmMock).not.toHaveBeenCalled();
  });

  it("a student cannot, and an admin can remove a photo", async () => {
    as("STUDENT");
    expect((await request(app).delete("/api/hostels/h1/images/i1")).status).toBe(403);
    as("ADMIN");
    cmMock.mockResolvedValueOnce(true);
    expect((await request(app).delete("/api/hostels/h1/images/i1")).status).toBe(200);
    expect(cmMock.mock.calls[0][1]).toEqual({ hostelId: "h1", imageId: "i1", actorId: "ADMIN-id" });
  });
});

describe("review routes", () => {
  it("only a student who has stayed can review, and it is filed under their own id", async () => {
    as("STUDENT");
    cqMock.mockResolvedValueOnce(["room-1"]).mockResolvedValueOnce(false);
    expect((await request(app).post("/api/reviews").send({ hostel_id: "h1", rating: 5 })).status).toBe(403);
    expect(cmMock).not.toHaveBeenCalled();

    cqMock.mockResolvedValueOnce(["room-1"]).mockResolvedValueOnce(true);
    cmMock.mockResolvedValueOnce({ id: "r1" });
    const ok = await request(app).post("/api/reviews").send({ hostel_id: "h1", rating: 4, comment: "Nice", student_id: "someone-else" });
    expect(ok.status).toBe(201);
    expect(cmMock.mock.calls[0][1].data).toMatchObject({ student_id: "STUDENT-id", rating: 4, replace_existing: true });
  });

  it("rejects an out-of-range rating and non-students", async () => {
    as("STUDENT");
    expect((await request(app).post("/api/reviews").send({ hostel_id: "h1", rating: 6 })).status).toBe(400);
    as("HOSTEL_MANAGER");
    expect((await request(app).post("/api/reviews").send({ hostel_id: "h1", rating: 5 })).status).toBe(403);
  });
});

describe("admin console routes", () => {
  it("the admin hostel list is admin-only, validates the filter, and is not shadowed by /:id", async () => {
    as("HOSTEL_MANAGER");
    expect((await request(app).get("/api/hostels/admin/all")).status).toBe(403);
    as("ADMIN");
    cqMock.mockResolvedValueOnce([{ id: "h1" }]);
    const ok = await request(app).get("/api/hostels/admin/all?status=PENDING");
    expect(ok.status).toBe(200);
    expect(cqMock.mock.calls[0][1]).toEqual({ status: "PENDING" });
    expect((await request(app).get("/api/hostels/admin/all?status=NOPE")).status).toBe(400);
  });

  it("rejecting a hostel needs a reason; the actor and reason reach the mutation", async () => {
    as("ADMIN");
    expect((await request(app).patch("/api/hostels/h1/status").send({ status: "REJECTED" })).status).toBe(400);
    expect((await request(app).patch("/api/hostels/h1/status").send({ status: "REJECTED", reason: "no" })).status).toBe(400);
    cmMock.mockResolvedValueOnce({ id: "h1" });
    const ok = await request(app).patch("/api/hostels/h1/status").send({ status: "REJECTED", reason: "Photos too dark" });
    expect(ok.status).toBe(200);
    expect(cmMock.mock.calls[0][1]).toMatchObject({ id: "h1", patch: { status: "REJECTED" }, actorId: "ADMIN-id", reason: "Photos too dark" });
    cmMock.mockResolvedValueOnce({ id: "h1" });
    expect((await request(app).patch("/api/hostels/h1/status").send({ status: "APPROVED" })).status).toBe(200);
    as("HOSTEL_MANAGER");
    expect((await request(app).patch("/api/hostels/h1/status").send({ status: "APPROVED" })).status).toBe(403);
  });

  it("suspension: admin only, needs a reason, never yourself, never the last admin", async () => {
    as("STUDENT");
    expect((await request(app).patch("/api/users/u1/suspension").send({ suspended: true, reason: "x y z" })).status).toBe(403);

    as("ADMIN");
    expect((await request(app).patch("/api/users/u1/suspension").send({ suspended: true })).status).toBe(400);
    expect((await request(app).patch("/api/users/ADMIN-id/suspension").send({ suspended: true, reason: "oops" })).status).toBe(400);
    expect(cmMock).not.toHaveBeenCalled();

    // the last other active admin can't be suspended
    cqMock.mockResolvedValueOnce({ id: "a2", user_type: "ADMIN" }).mockResolvedValueOnce([{ id: "a2", user_type: "ADMIN" }, { id: "ADMIN-id", user_type: "ADMIN" }]);
    const last = await request(app).patch("/api/users/a2/suspension").send({ suspended: true, reason: "left company" });
    expect(last.status).toBe(200); // ADMIN-id is still active, so a2 may be suspended
    cqMock.mockResolvedValueOnce({ id: "a2", user_type: "ADMIN" }).mockResolvedValueOnce([{ id: "a2", user_type: "ADMIN" }]);
    cmMock.mockReset();
    expect((await request(app).patch("/api/users/a2/suspension").send({ suspended: true, reason: "left company" })).status).toBe(400);
    expect(cmMock).not.toHaveBeenCalled();

    cqMock.mockResolvedValueOnce({ id: "s1", user_type: "STUDENT" });
    cmMock.mockResolvedValueOnce({ id: "s1" });
    const ok = await request(app).patch("/api/users/s1/suspension").send({ suspended: true, reason: "Fake student ID" });
    expect(ok.status).toBe(200);
    expect(cmMock.mock.calls[0][1]).toMatchObject({ id: "s1", suspended: true, reason: "Fake student ID", actorId: "ADMIN-id" });
  });

  it("a suspended account is refused on every authenticated route", async () => {
    session.user = { id: "s1", user_type: "STUDENT", suspended_at: 1 };
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("review removal, school deletion and the audit log are admin-only", async () => {
    as("HOSTEL_MANAGER");
    expect((await request(app).delete("/api/reviews/r1")).status).toBe(403);
    expect((await request(app).delete("/api/schools/s1")).status).toBe(403);
    expect((await request(app).get("/api/audit")).status).toBe(403);

    as("ADMIN");
    cmMock.mockResolvedValueOnce(true);
    expect((await request(app).delete("/api/reviews/r1").send({ reason: "spam" })).status).toBe(200);
    expect(cmMock.mock.calls.at(-1)[1]).toMatchObject({ id: "r1", actorId: "ADMIN-id", reason: "spam" });
    cmMock.mockResolvedValueOnce(false);
    expect((await request(app).delete("/api/reviews/gone")).status).toBe(404);
    cmMock.mockResolvedValueOnce({ detached: 2 });
    expect((await request(app).delete("/api/schools/s1")).status).toBe(200);
    cqMock.mockResolvedValueOnce([]);
    expect((await request(app).get("/api/audit?limit=9999")).status).toBe(200);
    expect(cqMock.mock.calls.at(-1)[1]).toEqual({ limit: 500 });
  });
});

describe("password reset requests", () => {
  it("are rate limited (5 an hour) before they reach the auth handler", async () => {
    const codes = [];
    for (let i = 0; i < 7; i++) {
      const r = await request(app).post("/api/auth/request-password-reset").send({ email: "a@b.com", redirectTo: "http://localhost:5173/reset-password" });
      codes.push(r.status);
    }
    expect(codes.slice(0, 5).every((c) => c === 200)).toBe(true);
    expect(codes.slice(5)).toEqual([429, 429]);
  });

  it("choosing the new password has its own, looser budget", async () => {
    // The request budget is already spent by the test above; confirming must still work.
    const codes = [];
    for (let i = 0; i < 6; i++) {
      const r = await request(app).post("/api/auth/reset-password").send({ token: "t", newPassword: "longenough1" });
      codes.push(r.status);
    }
    expect(codes.every((c) => c !== 429)).toBe(true);
  });
});

