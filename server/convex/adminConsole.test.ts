import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;
const NOW = Date.UTC(2026, 6, 15, 12);

const user = (t: any, email: string, user_type: string, extra: Record<string, any> = {}) =>
  t.run(async (ctx: any) =>
    ctx.db.insert("users", { name: email.split("@")[0], email, emailVerified: false, user_type, profile_complete: true, ...extra }));

const hostel = (t: any, manager_id: any, hostel_name: string, status = "PENDING") =>
  t.run(async (ctx: any) =>
    ctx.db.insert("hostels", { hostel_name, location: "Berekuso", total_rooms: 0, available_rooms: 0, manager_id, status, created_at: NOW, updated_at: NOW }));

const notes = (t: any, userId: any) => t.query(api.notifications.listForUser, { userId, secret });
const logs = (t: any) => t.query(api.auditLogs.list, { secret });

describe("admin hostels", () => {
  it("lists hostels in every status with manager, rooms, beds and photos", async () => {
    const t = convexTest(schema, modules);
    const m = await user(t, "kwame@x.com", "HOSTEL_MANAGER", { phone: "0245550100", business_name: "Dufie Ltd" });
    const live = await hostel(t, m, "Dufie Annex", "APPROVED");
    await hostel(t, m, "Pending One", "PENDING");
    await t.run(async (ctx: any) => {
      await ctx.db.insert("rooms", { room_number: "1", room_type: "QUAD", price_per_bed: 1, capacity: 4, current_occupancy: 1, is_available: true, hostel_id: live, created_at: NOW, updated_at: NOW });
      await ctx.db.insert("hostelImages", { hostel_id: live, image_url: "/img/a.webp" });
    });

    const all = await t.query(api.hostels.listForAdmin, { secret });
    expect(all.map((h: any) => h.hostel_name).sort()).toEqual(["Dufie Annex", "Pending One"]);
    const dufie = all.find((h: any) => h.hostel_name === "Dufie Annex");
    expect(dufie).toMatchObject({ rooms_total: 1, beds_total: 4, beds_filled: 1, manager: { name: "kwame", phone: "0245550100", business_name: "Dufie Ltd" } });
    expect(dufie.images).toEqual([expect.objectContaining({ url: "/img/a.webp" })]);

    const pending = await t.query(api.hostels.listForAdmin, { status: "PENDING", secret });
    expect(pending.map((h: any) => h.hostel_name)).toEqual(["Pending One"]);
  });

  it("a new hostel notifies every active admin, not suspended ones or managers", async () => {
    const t = convexTest(schema, modules);
    const m = await user(t, "m@x.com", "HOSTEL_MANAGER");
    const a1 = await user(t, "a1@x.com", "ADMIN");
    const a2 = await user(t, "a2@x.com", "ADMIN", { suspended_at: NOW });
    await t.mutation(api.hostels.create, { data: { hostel_name: "New Hall", location: "Madina", manager_id: m }, secret });
    expect((await notes(t, a1))[0]).toMatchObject({ type: "hostel_pending", link: "/admin/hostels?status=PENDING" });
    expect(await notes(t, a2)).toHaveLength(0);
    expect(await notes(t, m)).toHaveLength(0);
  });

  it("approving or rejecting records who, when and why, tells the manager and is audited", async () => {
    const t = convexTest(schema, modules);
    const m = await user(t, "m@x.com", "HOSTEL_MANAGER");
    const admin = await user(t, "boss@x.com", "ADMIN");
    const h = await hostel(t, m, "Sunrise Lodge");

    const rejected = await t.mutation(api.hostels.update, { id: h, patch: { status: "REJECTED" }, actorId: admin, reason: "Photos are too dark", secret });
    expect(rejected).toMatchObject({ status: "REJECTED", status_reason: "Photos are too dark" });
    expect((await notes(t, m))[0]).toMatchObject({ type: "hostel_rejected" });
    expect((await notes(t, m))[0].message).toContain("Photos are too dark");

    await t.mutation(api.hostels.update, { id: h, patch: { status: "APPROVED" }, actorId: admin, secret });
    const approved = (await t.query(api.hostels.listForAdmin, { secret }))[0];
    expect(approved).toMatchObject({ status: "APPROVED", reviewed_by_name: "boss" });
    expect(approved.status_reason).toBeUndefined(); // an approval clears the old rejection reason

    const entries = await logs(t);
    expect(entries.map((e: any) => e.action)).toEqual(["hostel.approved", "hostel.rejected"]);
    expect(entries[1].summary).toContain("Photos are too dark");
    expect(entries[0].actor).toMatchObject({ name: "boss" });
  });

  it("changes without an actor are not audited, and editing other fields isn't a decision", async () => {
    const t = convexTest(schema, modules);
    const m = await user(t, "m@x.com", "HOSTEL_MANAGER");
    const h = await hostel(t, m, "Palm Court");
    await t.mutation(api.hostels.update, { id: h, patch: { description: "Nice" }, secret });
    expect(await logs(t)).toHaveLength(0);
    expect(await notes(t, m)).toHaveLength(0);
  });
});

describe("suspension", () => {
  it("suspending ends open sessions, is reversible, and is audited", async () => {
    const t = convexTest(schema, modules);
    const admin = await user(t, "a@x.com", "ADMIN");
    const s = await user(t, "s@x.com", "STUDENT");
    await t.run(async (ctx: any) => {
      await ctx.db.insert("sessions", { expiresAt: NOW + 1e9, token: "t1", userId: s });
      await ctx.db.insert("sessions", { expiresAt: NOW + 1e9, token: "t2", userId: s });
    });

    expect(await t.query(api.users.getSuspension, { id: s, secret })).toEqual({ suspended: false, reason: null });
    await t.mutation(api.users.setSuspended, { id: s, suspended: true, reason: "Fake ID", actorId: admin, secret });
    expect(await t.query(api.users.getSuspension, { id: s, secret })).toEqual({ suspended: true, reason: "Fake ID" });
    expect(await t.run(async (ctx: any) => ctx.db.query("sessions").collect())).toHaveLength(0);

    await t.mutation(api.users.setSuspended, { id: s, suspended: false, actorId: admin, secret });
    expect(await t.query(api.users.getSuspension, { id: s, secret })).toEqual({ suspended: false, reason: null });
    expect((await logs(t)).map((e: any) => e.action)).toEqual(["user.reactivated", "user.suspended"]);
  });

  it("adminDetail summarises bookings and owned hostels", async () => {
    const t = convexTest(schema, modules);
    const m = await user(t, "m@x.com", "HOSTEL_MANAGER");
    const s = await user(t, "s@x.com", "STUDENT");
    const h = await hostel(t, m, "Dufie", "APPROVED");
    const r = await t.run(async (ctx: any) => ctx.db.insert("rooms", { room_number: "1", room_type: "DOUBLE", price_per_bed: 5, capacity: 2, current_occupancy: 0, is_available: true, hostel_id: h, created_at: NOW, updated_at: NOW }));
    await t.run(async (ctx: any) => {
      await ctx.db.insert("bookings", { check_in_date: NOW, check_out_date: NOW + 1, status: "CONFIRMED", student_id: s, room_id: r, amount_paid: 8500, created_at: NOW, updated_at: NOW });
      await ctx.db.insert("bookings", { check_in_date: NOW, check_out_date: NOW + 1, status: "PENDING", student_id: s, room_id: r, created_at: NOW, updated_at: NOW });
    });
    expect((await t.query(api.users.adminDetail, { id: s, secret })).booking_counts).toEqual({ total: 2, confirmed: 1, pending: 1, spent: 8500 });
    expect((await t.query(api.users.adminDetail, { id: m, secret })).hostels).toEqual([expect.objectContaining({ hostel_name: "Dufie" })]);
  });
});

describe("moderation and school clean-up", () => {
  it("removing a review deletes it and logs who removed what", async () => {
    const t = convexTest(schema, modules);
    const m = await user(t, "m@x.com", "HOSTEL_MANAGER");
    const admin = await user(t, "a@x.com", "ADMIN");
    const s = await user(t, "s@x.com", "STUDENT");
    const h = await hostel(t, m, "Dufie", "APPROVED");
    const review = await t.mutation(api.reviews.create, { data: { rating: 1, comment: "spam", student_id: s, hostel_id: h }, secret });

    const listed = await t.query(api.reviews.listByHostel, { secret });
    expect(listed[0].HOSTEL).toEqual({ hostel_name: "Dufie" });

    expect(await t.mutation(api.reviews.remove, { id: review.id, actorId: admin, reason: "Spam", secret })).toBe(true);
    expect(await t.query(api.reviews.listByHostel, { secret })).toHaveLength(0);
    expect(await t.mutation(api.reviews.remove, { id: review.id, secret })).toBe(false);
    expect((await logs(t))[0]).toMatchObject({ action: "review.removed" });
    expect((await logs(t))[0].summary).toContain("1-star");
  });

  it("deleting a school detaches its hostels instead of deleting them", async () => {
    const t = convexTest(schema, modules);
    const m = await user(t, "m@x.com", "HOSTEL_MANAGER");
    const admin = await user(t, "a@x.com", "ADMIN");
    const school = await t.mutation(api.schools.create, { name: "Ashesi", location: "Berekuso", email_domain: "ashesi.edu.gh", actorId: admin, secret });
    const h = await hostel(t, m, "Dufie", "APPROVED");
    await t.mutation(api.schools.assignHostel, { schoolId: school.id, hostelId: h, secret });

    expect(await t.mutation(api.schools.remove, { id: school.id, actorId: admin, secret })).toEqual({ detached: 1 });
    expect(await t.query(api.schools.list, { secret })).toHaveLength(0);
    expect((await t.run(async (ctx: any) => ctx.db.get(h))).school_id).toBeUndefined();
    expect(await t.mutation(api.schools.remove, { id: school.id, secret })).toBeNull();
    expect((await logs(t)).map((e: any) => e.action)).toEqual(["school.deleted", "school.created"]);
  });

  it("platform settings changes are audited", async () => {
    const t = convexTest(schema, modules);
    const admin = await user(t, "a@x.com", "ADMIN");
    await t.mutation(api.settings.update, { maintenance_mode: true, actorId: admin, secret });
    expect((await logs(t))[0]).toMatchObject({ action: "settings.updated" });
    expect((await logs(t))[0].summary).toContain("maintenance_mode");
  });

  it("a complaint (not an enquiry) notifies admins", async () => {
    const t = convexTest(schema, modules);
    const m = await user(t, "m@x.com", "HOSTEL_MANAGER");
    const admin = await user(t, "a@x.com", "ADMIN");
    const s = await user(t, "s@x.com", "STUDENT");
    const h = await hostel(t, m, "Dufie", "APPROVED");
    await t.mutation(api.complaints.create, { data: { content: "Where is the wifi?", kind: "ENQUIRY", student_id: s, hostel_id: h, hostel_manager_id: m }, secret });
    expect(await notes(t, admin)).toHaveLength(0);
    await t.mutation(api.complaints.create, { data: { content: "No water", kind: "COMPLAINT", subject: "Water", student_id: s, hostel_id: h, hostel_manager_id: m }, secret });
    expect((await notes(t, admin))[0]).toMatchObject({ type: "complaint_new", link: "/admin/complaints" });
  });
});
