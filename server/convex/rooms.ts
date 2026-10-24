// server/convex/rooms.ts
import { v } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";

// Keeps hostels.total_rooms/available_rooms in step with the rooms that
// actually exist. Unlike the Supabase version this runs inside the same
// mutation as the room write, so the two can't drift under concurrency.
async function adjustHostelCounts(ctx: any, hostelId: any, totalDelta: number, availableDelta: number) {
  if (!totalDelta && !availableDelta) return;
  const hostel = await ctx.db.get(hostelId);
  if (!hostel) return;
  await ctx.db.patch(hostelId, {
    total_rooms: Math.max(0, hostel.total_rooms + totalDelta),
    available_rooms: Math.max(0, hostel.available_rooms + availableDelta),
    updated_at: Date.now(),
  });
}

export const list = secureQuery(
  {
    hostelId: v.optional(v.string()),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    roomType: v.optional(v.string()),
    isAvailable: v.optional(v.boolean()),
  },
  async (ctx, { hostelId, minPrice, maxPrice, roomType, isAvailable }) => {
    let rows;
    if (hostelId !== undefined) {
      const id = ctx.db.normalizeId("hostels", hostelId);
      if (!id) return [];
      rows = await ctx.db
        .query("rooms")
        .withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", id))
        .collect();
    } else {
      rows = await ctx.db.query("rooms").collect();
    }

    if (minPrice !== undefined) rows = rows.filter((r: any) => r.price_per_bed >= minPrice);
    if (maxPrice !== undefined) rows = rows.filter((r: any) => r.price_per_bed <= maxPrice);
    if (roomType !== undefined) rows = rows.filter((r: any) => r.room_type === roomType);
    if (isAvailable !== undefined) rows = rows.filter((r: any) => r.is_available === isAvailable);

    // The old query used HOSTEL!inner, so a room whose hostel is missing
    // was dropped from the result rather than returned with a null join.
    const out = [];
    for (const room of rows) {
      const hostel = await ctx.db.get(room.hostel_id);
      if (!hostel) continue;
      const row = toApiRow(room);
      row.HOSTEL = { hostel_name: hostel.hostel_name };
      out.push(row);
    }
    return out;
  }
);

export const getByIdWithRelations = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const roomId = ctx.db.normalizeId("rooms", id);
  if (!roomId) return null;
  const room = await ctx.db.get(roomId);
  if (!room) return null;

  const [images, scenes, amenities, hostel] = await Promise.all([
    ctx.db.query("roomImages").withIndex("by_room_id", (q: any) => q.eq("room_id", roomId)).collect(),
    ctx.db.query("roomTourScenes").withIndex("by_room_id", (q: any) => q.eq("room_id", roomId)).collect(),
    ctx.db.query("roomAmenities").withIndex("by_room_id", (q: any) => q.eq("room_id", roomId)).collect(),
    ctx.db.get(room.hostel_id),
  ]);

  const row = toApiRow(room);
  row.ROOM_IMAGE_URLS = images.map((i: any) => toApiRow(i));
  row.ROOM_TOUR_SCENES = scenes.map((s: any) => toApiRow(s));
  row.ROOM_AMENITY = amenities.map((a: any) => toApiRow(a));
  row.HOSTEL = hostel ? { hostel_name: hostel.hostel_name, location: hostel.location } : null;
  return row;
});

export const getBasics = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const roomId = ctx.db.normalizeId("rooms", id);
  if (!roomId) return null;
  const room = await ctx.db.get(roomId);
  if (!room) return null;
  return {
    id: room._id,
    hostel_id: room.hostel_id,
    is_available: room.is_available,
    capacity: room.capacity,
    current_occupancy: room.current_occupancy,
  };
});

export const listIdsByHostel = secureQuery({ hostelId: v.string() }, async (ctx, { hostelId }) => {
  const id = ctx.db.normalizeId("hostels", hostelId);
  if (!id) return [];
  const rows = await ctx.db
    .query("rooms")
    .withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", id))
    .collect();
  return rows.map((r: any) => r._id);
});

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  const hostelId = ctx.db.normalizeId("hostels", data.hostel_id);
  if (!hostelId) throw new Error("Hostel not found");
  const hostel = await ctx.db.get(hostelId);
  if (!hostel) throw new Error("Hostel not found");

  const now = Date.now();
  const roomId = await ctx.db.insert("rooms", {
    room_number: data.room_number,
    room_type: data.room_type,
    price_per_bed: data.price_per_bed,
    capacity: data.capacity,
    current_occupancy: 0,
    is_available: true,
    hostel_id: hostelId,
    length: data.length ?? undefined,
    width: data.width ?? undefined,
    height: data.height ?? undefined,
    created_at: now,
    updated_at: now,
  });

  await adjustHostelCounts(ctx, hostelId, 1, 1);
  return toApiRow((await ctx.db.get(roomId))!);
});

export const update = secureMutation({ id: v.string(), patch: v.any() }, async (ctx, { id, patch }) => {
  const roomId = ctx.db.normalizeId("rooms", id);
  if (!roomId) return null;
  const room = await ctx.db.get(roomId);
  if (!room) return null;

  const { hostel_id, id: _ignoredId, ...safePatch } = patch ?? {};
  await ctx.db.patch(roomId, { ...safePatch, updated_at: Date.now() });

  const patched = await ctx.db.get(roomId);
  if (!patched) return null;

  const nowAvailable = patched.current_occupancy < patched.capacity;
  if (nowAvailable !== patched.is_available) {
    await ctx.db.patch(roomId, { is_available: nowAvailable });
    await adjustHostelCounts(ctx, patched.hostel_id, 0, nowAvailable ? 1 : -1);
  }

  return toApiRow((await ctx.db.get(roomId))!);
});

export const remove = secureMutation({ id: v.string() }, async (ctx, { id }) => {
  const roomId = ctx.db.normalizeId("rooms", id);
  if (!roomId) return null;
  const room = await ctx.db.get(roomId);
  if (!room) return null;

  // Postgres did this with ON DELETE CASCADE; Convex has no equivalent, so
  // every dependent row is removed explicitly. Deleting a room therefore
  // still destroys its bookings, including CONFIRMED ones — identical to
  // the old behavior, and a deliberate choice.
  for (const table of ["roomImages", "roomTourScenes", "roomAmenities", "bookings"] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_room_id", (q: any) => q.eq("room_id", roomId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }

  const occupants = await ctx.db
    .query("users")
    .withIndex("by_current_room_id", (q: any) => q.eq("current_room_id", roomId))
    .collect();
  for (const occupant of occupants) {
    await ctx.db.patch(occupant._id, { current_room_id: undefined });
  }

  await adjustHostelCounts(ctx, room.hostel_id, -1, room.is_available ? -1 : 0);
  await ctx.db.delete(roomId);
  return { id: roomId };
});

export const addImages = secureMutation(
  { roomId: v.string(), urls: v.array(v.string()) },
  async (ctx, { roomId, urls }) => {
    const id = ctx.db.normalizeId("rooms", roomId);
    if (!id) throw new Error("Room not found");
    const created = [];
    for (const url of urls) {
      const rowId = await ctx.db.insert("roomImages", { room_id: id, image_url: url });
      created.push(toApiRow((await ctx.db.get(rowId))!));
    }
    return created;
  }
);

export const addTourScene = secureMutation(
  { roomId: v.string(), scene_name: v.string(), scene_config_url: v.string() },
  async (ctx, { roomId, scene_name, scene_config_url }) => {
    const id = ctx.db.normalizeId("rooms", roomId);
    if (!id) throw new Error("Room not found");
    const now = Date.now();
    const rowId = await ctx.db.insert("roomTourScenes", {
      room_id: id, scene_name, scene_config_url, created_at: now, updated_at: now,
    });
    return toApiRow((await ctx.db.get(rowId))!);
  }
);

export const removeTourScene = secureMutation({ id: v.string() }, async (ctx, { id }) => {
  const sceneId = ctx.db.normalizeId("roomTourScenes", id);
  if (!sceneId) return { success: true };
  const scene = await ctx.db.get(sceneId);
  if (scene) await ctx.db.delete(sceneId);
  return { success: true };
});
