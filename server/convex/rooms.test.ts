import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

async function makeHostel(t: ReturnType<typeof convexTest>, overrides: any = {}) {
  return await t.mutation(api.hostels.create, {
    data: {
      hostel_name: "Unity Hall", location: "North", total_rooms: 0, available_rooms: 0,
      status: "APPROVED", ...overrides,
    },
    secret,
  });
}

async function makeRoom(t: ReturnType<typeof convexTest>, hostelId: string, overrides: any = {}) {
  return await t.mutation(api.rooms.create, {
    data: {
      room_number: "A1", room_type: "SINGLE", price_per_bed: 400, capacity: 2,
      hostel_id: hostelId, ...overrides,
    },
    secret,
  });
}

describe("rooms", () => {
  it("create forces occupancy 0 / available true and bumps the hostel's counts", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id, { current_occupancy: 99, is_available: false });

    expect(room.current_occupancy).toBe(0);
    expect(room.is_available).toBe(true);
    expect(typeof room.created_at).toBe("string");

    const after = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(after!.total_rooms).toBe(1);
    expect(after!.available_rooms).toBe(1);
  });

  it("create rejects a malformed hostel id", async () => {
    const t = convexTest(schema, modules);
    await expect(makeRoom(t, "bogus")).rejects.toThrow(/hostel not found/i);
  });

  it("list nests HOSTEL.hostel_name and applies price, type and availability filters", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    await makeRoom(t, hostel.id, { room_number: "A1", price_per_bed: 300, room_type: "SINGLE" });
    await makeRoom(t, hostel.id, { room_number: "A2", price_per_bed: 700, room_type: "DOUBLE" });

    const all = await t.query(api.rooms.list, { hostelId: hostel.id, secret });
    expect(all).toHaveLength(2);
    expect(all[0].HOSTEL).toEqual({ hostel_name: "Unity Hall" });

    expect(await t.query(api.rooms.list, { minPrice: 500, secret })).toHaveLength(1);
    expect(await t.query(api.rooms.list, { maxPrice: 500, secret })).toHaveLength(1);
    expect(await t.query(api.rooms.list, { roomType: "DOUBLE", secret })).toHaveLength(1);
    expect(await t.query(api.rooms.list, { isAvailable: true, secret })).toHaveLength(2);
  });

  it("list excludes a room whose hostel row is gone, matching HOSTEL!inner (Review Focus #3)", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id);
    await t.run(async (ctx) => {
      await ctx.db.delete(ctx.db.normalizeId("hostels", hostel.id)!);
    });

    expect(await t.query(api.rooms.list, { secret })).toHaveLength(0);

    // ...but fetching it directly still works, with HOSTEL null.
    const row = await t.query(api.rooms.getByIdWithRelations, { id: room.id, secret });
    expect(row).not.toBeNull();
    expect(row!.HOSTEL).toBeNull();
  });

  it("getByIdWithRelations nests images, tour scenes and amenities with ISO dates (Review Focus #5)", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id);
    await t.mutation(api.rooms.addImages, { roomId: room.id, urls: ["https://example.com/r.jpg"], secret });
    await t.mutation(api.rooms.addTourScene, {
      roomId: room.id, scene_name: "Bedroom", scene_config_url: "https://example.com/tour.json", secret,
    });
    await t.mutation(api.amenities.addForRoom, { roomId: room.id, names: ["WIFI"], secret });

    const row = await t.query(api.rooms.getByIdWithRelations, { id: room.id, secret });
    expect(row!.ROOM_IMAGE_URLS[0].image_url).toBe("https://example.com/r.jpg");
    expect(row!.ROOM_TOUR_SCENES[0].scene_name).toBe("Bedroom");
    expect(typeof row!.ROOM_TOUR_SCENES[0].created_at).toBe("string");
    expect(row!.ROOM_AMENITY[0].name).toBe("WIFI");
    expect(row!.HOSTEL).toEqual({ hostel_name: "Unity Hall", location: "North" });
  });

  it("getByIdWithRelations and getBasics return null for a malformed id (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.rooms.getByIdWithRelations, { id: "123", secret })).toBeNull();
    expect(await t.query(api.rooms.getBasics, { id: "123", secret })).toBeNull();
  });

  it("getBasics returns just the fields callers need for checks", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id);
    const basics = await t.query(api.rooms.getBasics, { id: room.id, secret });
    expect(basics).toEqual({
      id: room.id, hostel_id: hostel.id, is_available: true, capacity: 2, current_occupancy: 0,
    });
  });

  it("update recomputes availability and adjusts the hostel's available_rooms", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id, { capacity: 2 });

    const filled = await t.mutation(api.rooms.update, {
      id: room.id, patch: { current_occupancy: 2 }, secret,
    });
    expect(filled!.is_available).toBe(false);

    let h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.available_rooms).toBe(0);

    const freed = await t.mutation(api.rooms.update, { id: room.id, patch: { current_occupancy: 1 }, secret });
    expect(freed!.is_available).toBe(true);
    h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.available_rooms).toBe(1);

    expect(await t.mutation(api.rooms.update, { id: "bogus", patch: {}, secret })).toBeNull();
  });

  it("remove cascades images, scenes, amenities and bookings, clears current_room_id, and fixes counts", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id);
    const student = await t.mutation(api.users.create, {
      data: { name: "Ama", email: "ama-rm@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: true },
      secret,
    });

    await t.mutation(api.rooms.addImages, { roomId: room.id, urls: ["https://example.com/x.jpg"], secret });
    await t.mutation(api.rooms.addTourScene, {
      roomId: room.id, scene_name: "S", scene_config_url: "https://example.com/t.json", secret,
    });
    await t.mutation(api.amenities.addForRoom, { roomId: room.id, names: ["WIFI"], secret });
    await t.run(async (ctx) => {
      const rid = ctx.db.normalizeId("rooms", room.id)!;
      await ctx.db.insert("bookings", {
        check_in_date: Date.now(), check_out_date: Date.now() + 1000, status: "CONFIRMED",
        student_id: ctx.db.normalizeId("users", student.id)!, room_id: rid,
        created_at: Date.now(), updated_at: Date.now(),
      });
      await ctx.db.patch(ctx.db.normalizeId("users", student.id)!, { current_room_id: rid });
    });

    await t.mutation(api.rooms.remove, { id: room.id, secret });

    const leftovers = await t.run(async (ctx) => ({
      rooms: await ctx.db.query("rooms").collect(),
      images: await ctx.db.query("roomImages").collect(),
      scenes: await ctx.db.query("roomTourScenes").collect(),
      amenities: await ctx.db.query("roomAmenities").collect(),
      bookings: await ctx.db.query("bookings").collect(),
    }));
    expect(leftovers.rooms).toHaveLength(0);
    expect(leftovers.images).toHaveLength(0);
    expect(leftovers.scenes).toHaveLength(0);
    expect(leftovers.amenities).toHaveLength(0);
    expect(leftovers.bookings).toHaveLength(0);

    const me = await t.query(api.users.getMeWithRoom, { id: student.id, secret });
    expect(me!.current_room_id).toBeUndefined();
    expect(me!.ROOM).toBeNull();

    const h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.total_rooms).toBe(0);
    expect(h!.available_rooms).toBe(0);
  });

  it("listIdsByHostel returns the hostel's room ids, and removeTourScene deletes one scene", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id);
    expect(await t.query(api.rooms.listIdsByHostel, { hostelId: hostel.id, secret })).toEqual([room.id]);
    expect(await t.query(api.rooms.listIdsByHostel, { hostelId: "bogus", secret })).toEqual([]);

    const scene = await t.mutation(api.rooms.addTourScene, {
      roomId: room.id, scene_name: "S", scene_config_url: "https://example.com/t.json", secret,
    });
    await t.mutation(api.rooms.removeTourScene, { id: scene.id, roomId: room.id, secret });
    const scenes = await t.run(async (ctx) => await ctx.db.query("roomTourScenes").collect());
    expect(scenes).toHaveLength(0);
  });

  it("update ignores a caller-supplied is_available and does not drift available_rooms", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id);
    const r = await t.mutation(api.rooms.update, { id: room.id, patch: { is_available: false }, secret });
    expect(r!.is_available).toBe(true);
    const h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.available_rooms).toBe(1);

    await t.mutation(api.rooms.update, { id: room.id, patch: { current_occupancy: 2 }, secret });
    const full = await t.mutation(api.rooms.update, { id: room.id, patch: { is_available: true }, secret });
    expect(full!.is_available).toBe(false);
    const h2 = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h2!.available_rooms).toBe(0);
  });

  it("a non-flipping update leaves available_rooms unchanged", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id);
    await t.mutation(api.rooms.update, { id: room.id, patch: { room_number: "Z9" }, secret });
    const h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.available_rooms).toBe(1);
    expect(h!.total_rooms).toBe(1);
  });

  it("removeTourScene ignores a scene that belongs to a different room", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const a = await makeRoom(t, hostel.id, { room_number: "A1" });
    const b = await makeRoom(t, hostel.id, { room_number: "B1" });
    await t.mutation(api.rooms.addTourScene, { roomId: a.id, scene_name: "A", scene_config_url: "https://example.com/a.json", secret });
    const sceneB = await t.mutation(api.rooms.addTourScene, { roomId: b.id, scene_name: "B", scene_config_url: "https://example.com/b.json", secret });
    const res = await t.mutation(api.rooms.removeTourScene, { id: sceneB.id, roomId: a.id, secret });
    expect(res).toEqual({ success: true });
    const scenes = await t.run(async (ctx) => await ctx.db.query("roomTourScenes").collect());
    expect(scenes).toHaveLength(2);
  });

  it("remove of an already-unavailable room decrements total_rooms but not available_rooms", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const full = await makeRoom(t, hostel.id, { room_number: "F1" });
    await makeRoom(t, hostel.id, { room_number: "F2" });
    await t.mutation(api.rooms.update, { id: full.id, patch: { current_occupancy: 2 }, secret });
    await t.mutation(api.rooms.remove, { id: full.id, secret });
    const h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.total_rooms).toBe(1);
    expect(h!.available_rooms).toBe(1);
  });
});
