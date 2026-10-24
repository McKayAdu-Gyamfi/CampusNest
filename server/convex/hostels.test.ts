import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

async function makeManager(t: ReturnType<typeof convexTest>, email = "mgr@test.com") {
  return await t.mutation(api.users.create, {
    data: { name: "Mgr", email, emailVerified: false, user_type: "HOSTEL_MANAGER", profile_complete: true },
    secret,
  });
}

describe("hostels", () => {
  it("create returns the hostel with ISO timestamps and an id", async () => {
    const t = convexTest(schema, modules);
    const mgr = await makeManager(t);
    const hostel = await t.mutation(api.hostels.create, {
      data: {
        hostel_name: "Unity Hall", location: "North Campus", description: "Nice",
        total_rooms: 10, available_rooms: 10, distance_from_campus: 1.5,
        manager_id: mgr.id, status: "PENDING",
      },
      secret,
    });
    expect(hostel.id).toBeTruthy();
    expect(hostel.status).toBe("PENDING");
    expect(typeof hostel.created_at).toBe("string");
    expect(Number.isNaN(Date.parse(hostel.created_at))).toBe(false);
  });

  it("listApproved returns only APPROVED hostels, each with a nested manager", async () => {
    const t = convexTest(schema, modules);
    const mgr = await makeManager(t);
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Approved One", location: "North", total_rooms: 1, available_rooms: 1,
              manager_id: mgr.id, status: "APPROVED" },
      secret,
    });
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Pending One", location: "South", total_rooms: 1, available_rooms: 1,
              manager_id: mgr.id, status: "PENDING" },
      secret,
    });

    const rows = await t.query(api.hostels.listApproved, { secret });
    expect(rows).toHaveLength(1);
    expect(rows[0].hostel_name).toBe("Approved One");
    expect(rows[0].manager).toEqual({ id: mgr.id, email: "mgr@test.com" });
  });

  it("listApproved search matches hostel_name or location, case-insensitively", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Unity Hall", location: "North", total_rooms: 1, available_rooms: 1, status: "APPROVED" },
      secret,
    });
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Legon Lodge", location: "Unity Road", total_rooms: 1, available_rooms: 1, status: "APPROVED" },
      secret,
    });

    expect(await t.query(api.hostels.listApproved, { search: "unity", secret })).toHaveLength(2);
    expect(await t.query(api.hostels.listApproved, { search: "LEGON", secret })).toHaveLength(1);
    expect(await t.query(api.hostels.listApproved, { search: "nowhere", secret })).toHaveLength(0);
  });

  it("maxDistance excludes hostels with no distance recorded (Review Focus #2)", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Close", location: "N", total_rooms: 1, available_rooms: 1,
              distance_from_campus: 1, status: "APPROVED" },
      secret,
    });
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Unknown Distance", location: "N", total_rooms: 1, available_rooms: 1,
              status: "APPROVED" },
      secret,
    });

    const rows = await t.query(api.hostels.listApproved, { maxDistance: 5, secret });
    expect(rows.map((r: any) => r.hostel_name)).toEqual(["Close"]);
  });

  it("getByIdWithRelations nests ROOM, HOSTEL_IMAGE_URLS and HOSTEL_AMENITY with ISO dates (Review Focus #5)", async () => {
    const t = convexTest(schema, modules);
    const hostel = await t.mutation(api.hostels.create, {
      data: { hostel_name: "Unity Hall", location: "North", total_rooms: 1, available_rooms: 1, status: "APPROVED" },
      secret,
    });
    await t.run(async (ctx) => {
      const hid = ctx.db.normalizeId("hostels", hostel.id)!;
      await ctx.db.insert("rooms", {
        room_number: "A1", room_type: "SINGLE", price_per_bed: 400, capacity: 1,
        current_occupancy: 0, is_available: true, hostel_id: hid,
        created_at: Date.now(), updated_at: Date.now(),
      });
      await ctx.db.insert("hostelImages", { hostel_id: hid, image_url: "https://example.com/a.jpg" });
      await ctx.db.insert("hostelAmenities", { hostel_id: hid, name: "WIFI" });
    });

    const row = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(row!.ROOM).toHaveLength(1);
    expect(row!.ROOM[0].room_number).toBe("A1");
    expect(typeof row!.ROOM[0].created_at).toBe("string");
    expect(row!.HOSTEL_IMAGE_URLS[0].image_url).toBe("https://example.com/a.jpg");
    expect(row!.HOSTEL_AMENITY[0].name).toBe("WIFI");
  });

  it("getByIdWithRelations returns null for a malformed id (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.hostels.getByIdWithRelations, { id: "123", secret })).toBeNull();
  });

  it("countByManager and listByManager see every status", async () => {
    const t = convexTest(schema, modules);
    const mgr = await makeManager(t);
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "One", location: "N", total_rooms: 1, available_rooms: 1,
              manager_id: mgr.id, status: "APPROVED" },
      secret,
    });
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Two", location: "N", total_rooms: 1, available_rooms: 1,
              manager_id: mgr.id, status: "PENDING" },
      secret,
    });

    expect(await t.query(api.hostels.countByManager, { managerId: mgr.id, secret })).toBe(2);
    expect(await t.query(api.hostels.listByManager, { managerId: mgr.id, secret })).toHaveLength(2);
    expect(await t.query(api.hostels.countByManager, { managerId: "bogus", secret })).toBe(0);
  });

  it("getManagerId returns the manager or null", async () => {
    const t = convexTest(schema, modules);
    const mgr = await makeManager(t);
    const hostel = await t.mutation(api.hostels.create, {
      data: { hostel_name: "One", location: "N", total_rooms: 1, available_rooms: 1,
              manager_id: mgr.id, status: "APPROVED" },
      secret,
    });
    expect(await t.query(api.hostels.getManagerId, { id: hostel.id, secret })).toEqual({ manager_id: mgr.id });
    expect(await t.query(api.hostels.getManagerId, { id: "bogus", secret })).toBeNull();
  });

  it("update patches given fields and addImages returns the created rows", async () => {
    const t = convexTest(schema, modules);
    const hostel = await t.mutation(api.hostels.create, {
      data: { hostel_name: "One", location: "N", total_rooms: 1, available_rooms: 1, status: "PENDING" },
      secret,
    });
    const updated = await t.mutation(api.hostels.update, {
      id: hostel.id, patch: { status: "APPROVED" }, secret,
    });
    expect(updated!.status).toBe("APPROVED");
    expect(updated!.hostel_name).toBe("One");
    expect(await t.mutation(api.hostels.update, { id: "bogus", patch: { status: "APPROVED" }, secret })).toBeNull();

    const images = await t.mutation(api.hostels.addImages, {
      hostelId: hostel.id, urls: ["https://example.com/1.jpg", "https://example.com/2.jpg"], secret,
    });
    expect(images).toHaveLength(2);
    expect(images[0].hostel_id).toBe(hostel.id);
  });
});
