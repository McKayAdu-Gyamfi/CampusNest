import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

const JULY_15 = Date.UTC(2026, 6, 15, 12);
const JUNE_10 = Date.UTC(2026, 5, 10, 12);

async function user(t: any, email: string, user_type: string, name = email.split("@")[0]) {
  return await t.run(async (ctx: any) =>
    ctx.db.insert("users", { name, email, emailVerified: false, user_type, profile_complete: true })
  );
}

async function hostel(t: any, manager_id: any, hostel_name: string, status = "APPROVED") {
  return await t.run(async (ctx: any) =>
    ctx.db.insert("hostels", {
      hostel_name, location: "Berekuso", total_rooms: 0, available_rooms: 0,
      manager_id, status, created_at: JUNE_10, updated_at: JUNE_10,
    })
  );
}

async function room(t: any, hostel_id: any, capacity: number, occupancy: number, price: number) {
  return await t.run(async (ctx: any) =>
    ctx.db.insert("rooms", {
      room_number: "R" + Math.random().toString(36).slice(2, 6), room_type: "DOUBLE",
      price_per_bed: price, capacity, current_occupancy: occupancy,
      is_available: occupancy < capacity, hostel_id, created_at: JUNE_10, updated_at: JUNE_10,
    })
  );
}

async function booking(t: any, student_id: any, room_id: any, status: string, created_at: number) {
  return await t.run(async (ctx: any) =>
    ctx.db.insert("bookings", {
      check_in_date: created_at, check_out_date: created_at + 1, status,
      student_id, room_id, created_at, updated_at: created_at,
    })
  );
}

describe("settings", () => {
  it("returns defaults before any save, then persists an update", async () => {
    const t = convexTest(schema, modules);
    const before = await t.query(api.settings.get, { secret });
    expect(before).toMatchObject({ platform_name: "KayaCampus", maintenance_mode: false, updated_at: null });

    await t.mutation(api.settings.update, { maintenance_mode: true, secret });
    const after = await t.mutation(api.settings.update, { platform_name: "Kaya", secret });
    expect(after).toMatchObject({ platform_name: "Kaya", maintenance_mode: true, support_email: "support@kayacampus.com" });

    const rows = await t.run(async (ctx: any) => ctx.db.query("settings").collect());
    expect(rows).toHaveLength(1);
  });

  it("maintenance mode blocks new bookings with a structured code", async () => {
    const t = convexTest(schema, modules);
    const s = await user(t, "s@ashesi.edu.gh", "STUDENT");
    const m = await user(t, "m@x.com", "HOSTEL_MANAGER");
    const r = await room(t, await hostel(t, m, "A"), 2, 0, 100);
    await t.mutation(api.settings.update, { maintenance_mode: true, secret });

    await expect(
      t.mutation(api.bookings.create, { data: { room_id: r, student_id: s, check_in_date: JULY_15, check_out_date: JULY_15 }, secret })
    ).rejects.toMatchObject({ data: { code: "MAINTENANCE_MODE" } });

    await t.mutation(api.settings.update, { maintenance_mode: false, secret });
    const ok = await t.mutation(api.bookings.create, { data: { room_id: r, student_id: s, check_in_date: JULY_15, check_out_date: JULY_15 }, secret });
    expect(ok.status).toBe("PENDING");
  });
});

describe("schools", () => {
  it("creates, rejects a duplicate domain, and counts students by exact domain", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.schools.create, { name: "Ashesi", location: "Berekuso", email_domain: "@Ashesi.edu.GH", secret });
    await expect(
      t.mutation(api.schools.create, { name: "Dup", location: "x", email_domain: "ashesi.edu.gh", secret })
    ).rejects.toMatchObject({ data: { code: "DUPLICATE_SCHOOL_DOMAIN" } });

    await user(t, "a@ashesi.edu.gh", "STUDENT");
    await user(t, "b@ashesi.edu.gh", "STUDENT");
    await user(t, "c@students.ashesi.edu.gh", "STUDENT"); // subdomain: not counted
    await user(t, "m@ashesi.edu.gh", "HOSTEL_MANAGER"); // not a student

    const [school] = await t.query(api.schools.list, { secret });
    expect(school.email_domain).toBe("ashesi.edu.gh");
    expect(school.student_count).toBe(2);
    expect(school.hostel_count).toBe(0);
  });

  it("assigns, moves, lists and unassigns hostels; unassign is scoped to the school", async () => {
    const t = convexTest(schema, modules);
    const a = await t.mutation(api.schools.create, { name: "A", location: "x", email_domain: "a.edu", secret });
    const b = await t.mutation(api.schools.create, { name: "B", location: "x", email_domain: "b.edu", secret });
    const m = await user(t, "m@x.com", "HOSTEL_MANAGER");
    const h = await hostel(t, m, "Dufie", "PENDING");
    await room(t, h, 4, 1, 100);
    await room(t, h, 2, 0, 100);

    expect(await t.query(api.schools.listUnassignedHostels, { secret })).toHaveLength(1);
    await t.mutation(api.schools.assignHostel, { schoolId: a.id, hostelId: h, secret });
    const listed = await t.query(api.schools.listHostels, { schoolId: a.id, secret });
    expect(listed).toEqual([expect.objectContaining({ hostel_name: "Dufie", status: "PENDING", beds: 6 })]);
    expect(await t.query(api.schools.listUnassignedHostels, { secret })).toHaveLength(0);

    // moving to another school
    await t.mutation(api.schools.assignHostel, { schoolId: b.id, hostelId: h, secret });
    expect(await t.query(api.schools.listHostels, { schoolId: a.id, secret })).toHaveLength(0);

    // wrong school: no-op
    await t.mutation(api.schools.unassignHostel, { schoolId: a.id, hostelId: h, secret });
    expect(await t.query(api.schools.listHostels, { schoolId: b.id, secret })).toHaveLength(1);

    await t.mutation(api.schools.unassignHostel, { schoolId: b.id, hostelId: h, secret });
    expect(await t.query(api.schools.listHostels, { schoolId: b.id, secret })).toHaveLength(0);
  });

  it("malformed ids: list returns null, assign throws a code", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.schools.listHostels, { schoolId: "bogus", secret })).toBeNull();
    await expect(
      t.mutation(api.schools.assignHostel, { schoolId: "bogus", hostelId: "bogus", secret })
    ).rejects.toMatchObject({ data: { code: "SCHOOL_NOT_FOUND" } });
  });
});

describe("stats", () => {
  async function fixture(t: any) {
    const s = await user(t, "s@ashesi.edu.gh", "STUDENT", "Ama");
    const m1 = await user(t, "m1@x.com", "HOSTEL_MANAGER");
    const m2 = await user(t, "m2@x.com", "HOSTEL_MANAGER");
    const h1 = await hostel(t, m1, "Dufie");
    const h1b = await hostel(t, m1, "Pending One", "PENDING");
    const h2 = await hostel(t, m2, "Other");
    const r1 = await room(t, h1, 4, 3, 1000);
    const r2 = await room(t, h1b, 2, 0, 500);
    const r3 = await room(t, h2, 10, 5, 2000);
    await booking(t, s, r1, "CONFIRMED", JULY_15);
    await booking(t, s, r1, "CHECKED_OUT", JULY_15);
    await booking(t, s, r1, "PENDING", JULY_15);
    await booking(t, s, r1, "CANCELLED", JULY_15);
    await booking(t, s, r1, "CONFIRMED", JUNE_10);
    await booking(t, s, r3, "CONFIRMED", JULY_15);
    return { m1, m2, h1, r2 };
  }

  it("manager overview is scoped to their hostels and computes beds, revenue and pending", async () => {
    const t = convexTest(schema, modules);
    const { m1 } = await fixture(t);
    const o = await t.query(api.stats.managerOverview, { managerId: m1, asOf: JULY_15, secret });

    expect(o.beds_total).toBe(6); // 4 + 2, pending hostel included
    expect(o.beds_filled).toBe(3);
    expect(o.occupancy_rate).toBeCloseTo(0.5);
    expect(o.revenue_this_month).toBe(2000); // CONFIRMED + CHECKED_OUT in July, not PENDING/CANCELLED/June
    expect(o.month).toBe("Jul");
    expect(o.pending_bookings).toBe(1);
    expect(o.hostels.map((h: any) => h.hostel_name).sort()).toEqual(["Dufie", "Pending One"]);
    expect(o.recent_bookings).toHaveLength(4);
    expect(o.recent_bookings[0]).toMatchObject({ student_name: "Ama", hostel_name: "Dufie", amount: 1000 });
  });

  it("manager with no hostels gets zeros, not a division error", async () => {
    const t = convexTest(schema, modules);
    const lonely = await user(t, "x@x.com", "HOSTEL_MANAGER");
    const o = await t.query(api.stats.managerOverview, { managerId: lonely, asOf: JULY_15, secret });
    expect(o).toMatchObject({ beds_total: 0, occupancy_rate: 0, revenue_this_month: 0, pending_bookings: 0 });
  });

  it("admin overview: monthly series, top approved hostels, pending approvals, counts", async () => {
    const t = convexTest(schema, modules);
    await fixture(t);
    const o = await t.query(api.stats.adminOverview, { asOf: JULY_15, secret });

    expect(o.revenue_by_month).toHaveLength(7);
    expect(o.revenue_by_month.at(-1)).toMatchObject({ month: "Jul", revenue: 4000 }); // 1000+1000+2000
    expect(o.revenue_by_month.at(-2)).toMatchObject({ month: "Jun", revenue: 1000 });
    expect(o.revenue_this_month).toBe(4000);
    expect(o.revenue_total).toBe(5000);
    expect(o.top_hostels.map((h: any) => h.hostel_name)).toEqual(["Dufie", "Other"]); // 3 vs 1, pending excluded
    expect(o.pending_approvals).toEqual([expect.objectContaining({ hostel_name: "Pending One", manager_email: "m1@x.com" })]);
    expect(o.counts).toMatchObject({ students: 1, managers: 2, hostels: 3, approved_hostels: 2, bookings: 6 });
  });

  it("rejects a wrong secret", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.stats.adminOverview, { secret: "nope" })).rejects.toThrow(/unauthorized/i);
  });
});
