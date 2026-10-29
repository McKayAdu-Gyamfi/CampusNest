import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

const { cqMock, cmMock, session } = vi.hoisted(() => ({
  cqMock: vi.fn(),
  cmMock: vi.fn(),
  session: { user: null },
}));

vi.mock("../src/config/convexClient.js", () => ({ cq: cqMock, cm: cmMock, ca: vi.fn() }));

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
    expect(cmMock.mock.calls[0][1]).toEqual({ platform_name: "K" });

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

describe("maintenance mode on booking creation", () => {
  it("maps MAINTENANCE_MODE to 503", async () => {
    as("STUDENT");
    cqMock
      .mockResolvedValueOnce({ profile_complete: true }) // requireCompleteProfile
      .mockResolvedValueOnce({ id: "room-1", is_available: true }); // rooms.getBasics
    cmMock.mockRejectedValue(Object.assign(new Error("x"), { data: { code: "MAINTENANCE_MODE" } }));
    const res = await request(app)
      .post("/api/bookings")
      .send({ room_id: "room-1", student_id: "x", check_in_date: "2026-11-01T00:00:00Z", check_out_date: "2027-05-01T00:00:00Z" });
    expect(res.status).toBe(503);
  });
});
