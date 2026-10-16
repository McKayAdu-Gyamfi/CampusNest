// server/convex/amenities.ts
import { v, ConvexError } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureMutation } from "./lib/secureFunction";

const amenityNames = v.array(v.string());

// Control-flow signals travel as structured ConvexError data, not message
// text: production deployments redact plain Error messages from clients.
// The Express service maps these codes to HTTP statuses.
const duplicate = () => new ConvexError({ code: "DUPLICATE_AMENITY" as const });

async function assertNoHostelDuplicates(ctx: any, hostelId: any, names: string[]) {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) throw duplicate();
    seen.add(name);
    const existing = await ctx.db
      .query("hostelAmenities")
      .withIndex("by_hostel_id_name", (q: any) => q.eq("hostel_id", hostelId).eq("name", name))
      .unique();
    if (existing) throw duplicate();
  }
}

async function assertNoRoomDuplicates(ctx: any, roomId: any, names: string[]) {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) throw duplicate();
    seen.add(name);
    const existing = await ctx.db
      .query("roomAmenities")
      .withIndex("by_room_id_name", (q: any) => q.eq("room_id", roomId).eq("name", name))
      .unique();
    if (existing) throw duplicate();
  }
}

export const addForHostel = secureMutation(
  { hostelId: v.string(), names: amenityNames },
  async (ctx, { hostelId, names }) => {
    const id = ctx.db.normalizeId("hostels", hostelId);
    if (!id) throw new ConvexError({ code: "HOSTEL_NOT_FOUND" as const });
    await assertNoHostelDuplicates(ctx, id, names);
    const created = [];
    for (const name of names) {
      const rowId = await ctx.db.insert("hostelAmenities", { hostel_id: id, name: name as any });
      created.push(toApiRow((await ctx.db.get(rowId))!));
    }
    return created;
  }
);

export const replaceForHostel = secureMutation(
  { hostelId: v.string(), names: amenityNames },
  async (ctx, { hostelId, names }) => {
    const id = ctx.db.normalizeId("hostels", hostelId);
    if (!id) throw new ConvexError({ code: "HOSTEL_NOT_FOUND" as const });
    const existing = await ctx.db
      .query("hostelAmenities")
      .withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", id))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    if (names.length === 0) return [];
    await assertNoHostelDuplicates(ctx, id, names);
    const created = [];
    for (const name of names) {
      const rowId = await ctx.db.insert("hostelAmenities", { hostel_id: id, name: name as any });
      created.push(toApiRow((await ctx.db.get(rowId))!));
    }
    return created;
  }
);

export const removeHostelAmenity = secureMutation({ id: v.string() }, async (ctx, { id }) => {
  const rowId = ctx.db.normalizeId("hostelAmenities", id);
  if (!rowId) return { success: true };
  const row = await ctx.db.get(rowId);
  if (row) await ctx.db.delete(rowId);
  return { success: true };
});

export const addForRoom = secureMutation(
  { roomId: v.string(), names: amenityNames },
  async (ctx, { roomId, names }) => {
    const id = ctx.db.normalizeId("rooms", roomId);
    if (!id) throw new ConvexError({ code: "ROOM_NOT_FOUND" as const });
    await assertNoRoomDuplicates(ctx, id, names);
    const created = [];
    for (const name of names) {
      const rowId = await ctx.db.insert("roomAmenities", { room_id: id, name: name as any });
      created.push(toApiRow((await ctx.db.get(rowId))!));
    }
    return created;
  }
);

export const replaceForRoom = secureMutation(
  { roomId: v.string(), names: amenityNames },
  async (ctx, { roomId, names }) => {
    const id = ctx.db.normalizeId("rooms", roomId);
    if (!id) throw new ConvexError({ code: "ROOM_NOT_FOUND" as const });
    const existing = await ctx.db
      .query("roomAmenities")
      .withIndex("by_room_id", (q: any) => q.eq("room_id", id))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    if (names.length === 0) return [];
    await assertNoRoomDuplicates(ctx, id, names);
    const created = [];
    for (const name of names) {
      const rowId = await ctx.db.insert("roomAmenities", { room_id: id, name: name as any });
      created.push(toApiRow((await ctx.db.get(rowId))!));
    }
    return created;
  }
);

export const removeRoomAmenity = secureMutation({ id: v.string() }, async (ctx, { id }) => {
  const rowId = ctx.db.normalizeId("roomAmenities", id);
  if (!rowId) return { success: true };
  const row = await ctx.db.get(rowId);
  if (row) await ctx.db.delete(rowId);
  return { success: true };
});
