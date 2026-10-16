import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

async function seedHostelAndRoom(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const hostelId = await ctx.db.insert("hostels", {
      hostel_name: "Unity Hall", location: "North", total_rooms: 1, available_rooms: 1,
      status: "APPROVED", created_at: Date.now(), updated_at: Date.now(),
    });
    const roomId = await ctx.db.insert("rooms", {
      room_number: "A1", room_type: "SINGLE", price_per_bed: 400, capacity: 2,
      current_occupancy: 0, is_available: true, hostel_id: hostelId,
      created_at: Date.now(), updated_at: Date.now(),
    });
    return { hostelId, roomId };
  });
}

async function seedSecondHostel(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    await ctx.db.insert("hostels", {
      hostel_name: "Riverside", location: "South", total_rooms: 1, available_rooms: 1,
      status: "APPROVED", created_at: Date.now(), updated_at: Date.now(),
    })
  );
}

const allHostelAmenities = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => await ctx.db.query("hostelAmenities").collect());
const allRoomAmenities = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => await ctx.db.query("roomAmenities").collect());

describe("amenities", () => {
  it("addForHostel inserts and returns the created rows", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    const rows = await t.mutation(api.amenities.addForHostel, {
      hostelId, names: ["WIFI", "GYM"], secret,
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.name).sort()).toEqual(["GYM", "WIFI"]);
    expect(rows[0].id).toBeTruthy();
    expect(rows[0]).not.toHaveProperty("_id");
  });

  it("addForHostel rejects a duplicate (hostel_id, name) pair with DUPLICATE_AMENITY", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret });
    await expect(
      t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret })
    ).rejects.toMatchObject({ data: { code: "DUPLICATE_AMENITY" } });
  });

  it("addForHostel rejects a duplicate inside a single call with DUPLICATE_AMENITY", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await expect(
      t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI", "WIFI"], secret })
    ).rejects.toMatchObject({ data: { code: "DUPLICATE_AMENITY" } });
  });

  it("addForHostel writes nothing when a later name is a duplicate", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await t.mutation(api.amenities.addForHostel, { hostelId, names: ["GYM"], secret });
    await expect(
      t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI", "GYM", "LAUNDRY"], secret })
    ).rejects.toMatchObject({ data: { code: "DUPLICATE_AMENITY" } });
    const remaining = await allHostelAmenities(t);
    expect(remaining.map((r) => r.name)).toEqual(["GYM"]);
  });

  it("replaceForHostel clears the old set and inserts the new one", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI", "GYM"], secret });
    const rows = await t.mutation(api.amenities.replaceForHostel, {
      hostelId, names: ["PARKING"], secret,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("PARKING");
    expect(await allHostelAmenities(t)).toHaveLength(1);
  });

  it("replaceForHostel with an empty list removes everything and returns []", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret });
    const rows = await t.mutation(api.amenities.replaceForHostel, { hostelId, names: [], secret });
    expect(rows).toEqual([]);
    expect(await allHostelAmenities(t)).toHaveLength(0);
  });

  it("replaceForHostel rejects a duplicate inside the new list with DUPLICATE_AMENITY", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await expect(
      t.mutation(api.amenities.replaceForHostel, { hostelId, names: ["GYM", "GYM"], secret })
    ).rejects.toMatchObject({ data: { code: "DUPLICATE_AMENITY" } });
  });

  it("replaceForHostel on hostel B leaves hostel A's amenities untouched", async () => {
    const t = convexTest(schema, modules);
    const { hostelId: hostelA } = await seedHostelAndRoom(t);
    const hostelB = await seedSecondHostel(t);
    await t.mutation(api.amenities.addForHostel, { hostelId: hostelA, names: ["WIFI", "GYM"], secret });
    await t.mutation(api.amenities.addForHostel, { hostelId: hostelB, names: ["PARKING"], secret });
    await t.mutation(api.amenities.replaceForHostel, { hostelId: hostelB, names: [], secret });
    const remaining = await allHostelAmenities(t);
    expect(remaining.map((r) => r.name).sort()).toEqual(["GYM", "WIFI"]);
    expect(remaining.every((r) => r.hostel_id === hostelA)).toBe(true);
  });

  it("removeHostelAmenity deletes one row and resolves { success: true }", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    const [row] = await t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret });
    const result = await t.mutation(api.amenities.removeHostelAmenity, { id: row.id, secret });
    expect(result).toEqual({ success: true });
    expect(await allHostelAmenities(t)).toHaveLength(0);
  });

  it("removeHostelAmenity is a no-op resolving { success: true } for a malformed id", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret });
    const result = await t.mutation(api.amenities.removeHostelAmenity, { id: "bogus", secret });
    expect(result).toEqual({ success: true });
    expect(await allHostelAmenities(t)).toHaveLength(1);
  });

  it("removeHostelAmenity with a well-formed id from another table is a no-op", async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await seedHostelAndRoom(t);
    await t.mutation(api.amenities.addForRoom, { roomId, names: ["LAUNDRY"], secret });
    const [roomRow] = await allRoomAmenities(t);
    const result = await t.mutation(api.amenities.removeHostelAmenity, { id: roomRow._id, secret });
    expect(result).toEqual({ success: true });
    expect(await allRoomAmenities(t)).toHaveLength(1);
  });

  it("removeHostelAmenity with a valid id that no longer exists is a no-op", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    const [row] = await t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret });
    await t.mutation(api.amenities.removeHostelAmenity, { id: row.id, secret });
    const result = await t.mutation(api.amenities.removeHostelAmenity, { id: row.id, secret });
    expect(result).toEqual({ success: true });
    expect(await allHostelAmenities(t)).toHaveLength(0);
  });

  it("room amenities behave the same way, keyed by room_id", async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await seedHostelAndRoom(t);
    const rows = await t.mutation(api.amenities.addForRoom, { roomId, names: ["LAUNDRY"], secret });
    expect(rows[0].name).toBe("LAUNDRY");
    await expect(
      t.mutation(api.amenities.addForRoom, { roomId, names: ["LAUNDRY"], secret })
    ).rejects.toMatchObject({ data: { code: "DUPLICATE_AMENITY" } });
    const replaced = await t.mutation(api.amenities.replaceForRoom, { roomId, names: ["WIFI"], secret });
    expect(replaced.map((r: any) => r.name)).toEqual(["WIFI"]);
  });

  it("replaceForRoom with an empty list clears everything and returns []", async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await seedHostelAndRoom(t);
    await t.mutation(api.amenities.addForRoom, { roomId, names: ["WIFI", "GYM"], secret });
    const rows = await t.mutation(api.amenities.replaceForRoom, { roomId, names: [], secret });
    expect(rows).toEqual([]);
    expect(await allRoomAmenities(t)).toHaveLength(0);
  });

  it("replaceForRoom rejects a duplicate inside the new list with DUPLICATE_AMENITY", async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await seedHostelAndRoom(t);
    await expect(
      t.mutation(api.amenities.replaceForRoom, { roomId, names: ["WIFI", "WIFI"], secret })
    ).rejects.toMatchObject({ data: { code: "DUPLICATE_AMENITY" } });
  });

  it("removeRoomAmenity deletes one row and resolves { success: true }", async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await seedHostelAndRoom(t);
    const [row] = await t.mutation(api.amenities.addForRoom, { roomId, names: ["LAUNDRY"], secret });
    const result = await t.mutation(api.amenities.removeRoomAmenity, { id: row.id, secret });
    expect(result).toEqual({ success: true });
    expect(await allRoomAmenities(t)).toHaveLength(0);
  });

  it("removeRoomAmenity is a no-op resolving { success: true } for a malformed id", async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await seedHostelAndRoom(t);
    await t.mutation(api.amenities.addForRoom, { roomId, names: ["LAUNDRY"], secret });
    const result = await t.mutation(api.amenities.removeRoomAmenity, { id: "bogus", secret });
    expect(result).toEqual({ success: true });
    expect(await allRoomAmenities(t)).toHaveLength(1);
  });

  it("rejects a malformed hostel parent id with HOSTEL_NOT_FOUND", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.amenities.addForHostel, { hostelId: "bogus", names: ["WIFI"], secret })
    ).rejects.toMatchObject({ data: { code: "HOSTEL_NOT_FOUND" } });
  });

  it("replaceForHostel rejects a malformed parent id with HOSTEL_NOT_FOUND", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.amenities.replaceForHostel, { hostelId: "bogus", names: ["WIFI"], secret })
    ).rejects.toMatchObject({ data: { code: "HOSTEL_NOT_FOUND" } });
  });

  it("addForRoom rejects a malformed parent id with ROOM_NOT_FOUND", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.amenities.addForRoom, { roomId: "bogus", names: ["WIFI"], secret })
    ).rejects.toMatchObject({ data: { code: "ROOM_NOT_FOUND" } });
  });

  it("replaceForRoom rejects a malformed parent id with ROOM_NOT_FOUND", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.amenities.replaceForRoom, { roomId: "bogus", names: ["WIFI"], secret })
    ).rejects.toMatchObject({ data: { code: "ROOM_NOT_FOUND" } });
  });
});
