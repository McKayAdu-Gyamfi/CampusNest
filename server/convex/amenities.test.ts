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

  it("addForHostel rejects a duplicate (hostel_id, name) pair", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret });
    await expect(
      t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret })
    ).rejects.toThrow(/already added/i);
  });

  it("addForHostel rejects a duplicate inside a single call", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await expect(
      t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI", "WIFI"], secret })
    ).rejects.toThrow(/already added/i);
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

    const remaining = await t.run(async (ctx) =>
      await ctx.db.query("hostelAmenities").collect()
    );
    expect(remaining).toHaveLength(1);
  });

  it("replaceForHostel with an empty list removes everything and returns []", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret });
    const rows = await t.mutation(api.amenities.replaceForHostel, { hostelId, names: [], secret });
    expect(rows).toEqual([]);
    const remaining = await t.run(async (ctx) => await ctx.db.query("hostelAmenities").collect());
    expect(remaining).toHaveLength(0);
  });

  it("removeHostelAmenity deletes one row and is a no-op for a malformed id", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    const [row] = await t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret });
    await t.mutation(api.amenities.removeHostelAmenity, { id: row.id, secret });
    const remaining = await t.run(async (ctx) => await ctx.db.query("hostelAmenities").collect());
    expect(remaining).toHaveLength(0);
    await expect(
      t.mutation(api.amenities.removeHostelAmenity, { id: "bogus", secret })
    ).resolves.not.toThrow();
  });

  it("room amenities behave the same way, keyed by room_id", async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await seedHostelAndRoom(t);
    const rows = await t.mutation(api.amenities.addForRoom, { roomId, names: ["LAUNDRY"], secret });
    expect(rows[0].name).toBe("LAUNDRY");
    await expect(
      t.mutation(api.amenities.addForRoom, { roomId, names: ["LAUNDRY"], secret })
    ).rejects.toThrow(/already added/i);
    const replaced = await t.mutation(api.amenities.replaceForRoom, { roomId, names: ["WIFI"], secret });
    expect(replaced.map((r: any) => r.name)).toEqual(["WIFI"]);
  });

  it("rejects a malformed parent id", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.amenities.addForHostel, { hostelId: "bogus", names: ["WIFI"], secret })
    ).rejects.toThrow(/not found/i);
  });
});
