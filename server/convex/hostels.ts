// server/convex/hostels.ts
import { v } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";

async function withManager(ctx: any, hostel: any) {
  const row = toApiRow(hostel);
  row.manager = null;
  if (hostel.manager_id) {
    const manager = await ctx.db.get(hostel.manager_id);
    if (manager) row.manager = { id: manager._id, email: manager.email };
  }
  return row;
}

export const listApproved = secureQuery(
  { search: v.optional(v.string()), maxDistance: v.optional(v.number()) },
  async (ctx, { search, maxDistance }) => {
    let rows = await ctx.db
      .query("hostels")
      .withIndex("by_status", (q: any) => q.eq("status", "APPROVED"))
      .collect();

    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter(
        (h: any) =>
          h.hostel_name.toLowerCase().includes(needle) || h.location.toLowerCase().includes(needle)
      );
    }

    // Postgres .lte() on a NULL column is never true, so a hostel with no
    // recorded distance was excluded by the old filter. Match that: do not
    // treat a missing distance as 0.
    if (maxDistance !== undefined) {
      rows = rows.filter(
        (h: any) => h.distance_from_campus !== undefined && h.distance_from_campus <= maxDistance
      );
    }

    return await Promise.all(rows.map((h: any) => withManager(ctx, h)));
  }
);

export const getByIdWithRelations = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const hostelId = ctx.db.normalizeId("hostels", id);
  if (!hostelId) return null;
  const hostel = await ctx.db.get(hostelId);
  if (!hostel) return null;

  const [rooms, images, amenities] = await Promise.all([
    ctx.db.query("rooms").withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", hostelId)).collect(),
    ctx.db.query("hostelImages").withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", hostelId)).collect(),
    ctx.db.query("hostelAmenities").withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", hostelId)).collect(),
  ]);

  const row = toApiRow(hostel);
  row.ROOM = rooms.map((r: any) => toApiRow(r));
  row.HOSTEL_IMAGE_URLS = images.map((i: any) => toApiRow(i));
  row.HOSTEL_AMENITY = amenities.map((a: any) => toApiRow(a));
  return row;
});

export const countByManager = secureQuery({ managerId: v.string() }, async (ctx, { managerId }) => {
  const id = ctx.db.normalizeId("users", managerId);
  if (!id) return 0;
  const rows = await ctx.db
    .query("hostels")
    .withIndex("by_manager_id", (q: any) => q.eq("manager_id", id))
    .collect();
  return rows.length;
});

export const listByManager = secureQuery({ managerId: v.string() }, async (ctx, { managerId }) => {
  const id = ctx.db.normalizeId("users", managerId);
  if (!id) return [];
  const rows = await ctx.db
    .query("hostels")
    .withIndex("by_manager_id", (q: any) => q.eq("manager_id", id))
    .collect();
  return rows.map((h: any) => toApiRow(h));
});

export const getManagerId = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const hostelId = ctx.db.normalizeId("hostels", id);
  if (!hostelId) return null;
  const hostel = await ctx.db.get(hostelId);
  if (!hostel) return null;
  return { manager_id: hostel.manager_id ?? null };
});

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  const managerId = data.manager_id ? ctx.db.normalizeId("users", data.manager_id) : null;
  if (data.manager_id && !managerId) throw new Error("Manager not found");

  const now = Date.now();
  const hostelId = await ctx.db.insert("hostels", {
    hostel_name: data.hostel_name,
    location: data.location,
    description: data.description ?? undefined,
    total_rooms: data.total_rooms ?? 0,
    available_rooms: data.available_rooms ?? 0,
    distance_from_campus: data.distance_from_campus ?? undefined,
    manager_id: managerId ?? undefined,
    status: data.status ?? "PENDING",
    created_at: now,
    updated_at: now,
  });
  return toApiRow((await ctx.db.get(hostelId))!);
});

export const update = secureMutation({ id: v.string(), patch: v.any() }, async (ctx, { id, patch }) => {
  const hostelId = ctx.db.normalizeId("hostels", id);
  if (!hostelId) return null;
  const existing = await ctx.db.get(hostelId);
  if (!existing) return null;
  await ctx.db.patch(hostelId, { ...patch, updated_at: Date.now() });
  const updated = await ctx.db.get(hostelId);
  return updated ? toApiRow(updated) : null;
});

export const addImages = secureMutation(
  { hostelId: v.string(), urls: v.array(v.string()) },
  async (ctx, { hostelId, urls }) => {
    const id = ctx.db.normalizeId("hostels", hostelId);
    if (!id) throw new Error("Hostel not found");
    const created = [];
    for (const url of urls) {
      const rowId = await ctx.db.insert("hostelImages", { hostel_id: id, image_url: url });
      created.push(toApiRow((await ctx.db.get(rowId))!));
    }
    return created;
  }
);
