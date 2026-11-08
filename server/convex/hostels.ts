// server/convex/hostels.ts
import { v } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";
import { notify, notifyAdmins } from "./lib/notify";
import { audit } from "./lib/audit";

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

// Every hostel in any status, for the admin console. The public list only
// shows approved ones, so pending and rejected hostels need their own read.
export const listForAdmin = secureQuery(
  { status: v.optional(v.union(v.literal("PENDING"), v.literal("APPROVED"), v.literal("REJECTED"))) },
  async (ctx, { status }) => {
    const rows = status
      ? await ctx.db.query("hostels").withIndex("by_status", (q: any) => q.eq("status", status)).collect()
      : await ctx.db.query("hostels").collect();
    rows.sort((a: any, b: any) => b.created_at - a.created_at);

    return await Promise.all(
      rows.map(async (h: any) => {
        const row = toApiRow(h);
        const [rooms, images] = await Promise.all([
          ctx.db.query("rooms").withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", h._id)).collect(),
          ctx.db.query("hostelImages").withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", h._id)).collect(),
        ]);
        const manager = h.manager_id ? await ctx.db.get(h.manager_id) : null;
        const school = h.school_id ? await ctx.db.get(h.school_id) : null;
        const reviewer = h.reviewed_by ? await ctx.db.get(h.reviewed_by) : null;
        row.manager = manager
          ? { id: manager._id, name: manager.name, email: manager.email, phone: manager.phone ?? null, business_name: manager.business_name ?? null }
          : null;
        row.school = school ? { id: school._id, name: school.name } : null;
        row.reviewed_by_name = reviewer?.name ?? null;
        row.rooms_total = rooms.length;
        row.beds_total = rooms.reduce((s: number, r: any) => s + r.capacity, 0);
        row.beds_filled = rooms.reduce((s: number, r: any) => s + r.current_occupancy, 0);
        row.images = images.map((i: any) => ({ id: i._id, url: i.image_url }));
        return row;
      })
    );
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
  row.ROOM = await Promise.all(
    rooms.map(async (r: any) => {
      const scenes = await ctx.db.query("roomTourScenes").withIndex("by_room_id", (q: any) => q.eq("room_id", r._id)).collect();
      return { ...toApiRow(r), tour_scene_count: scenes.length };
    })
  );
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
  if ((data.status ?? "PENDING") === "PENDING") {
    await notifyAdmins(ctx, {
      type: "hostel_pending",
      title: "Hostel awaiting approval",
      message: `${data.hostel_name} (${data.location}) was submitted for review.`,
      link: "/admin/hostels?status=PENDING",
    });
  }
  return toApiRow((await ctx.db.get(hostelId))!);
});

export const update = secureMutation(
  { id: v.string(), patch: v.any(), actorId: v.optional(v.string()), reason: v.optional(v.string()) },
  async (ctx, { id, patch, actorId, reason }) => {
    const hostelId = ctx.db.normalizeId("hostels", id);
    if (!hostelId) return null;
    const existing = await ctx.db.get(hostelId);
    if (!existing) return null;
    const actor = actorId ? ctx.db.normalizeId("users", actorId) : null;
    const statusChanged = !!patch.status && patch.status !== existing.status;

    const next: Record<string, any> = { ...patch, updated_at: Date.now() };
    if (statusChanged) {
      // An approval or rejection is a decision: remember who made it, when, and why.
      next.status_reason = reason?.trim() || undefined;
      next.reviewed_by = actor ?? undefined;
      next.reviewed_at = Date.now();
    }
    await ctx.db.patch(hostelId, next);

    if (statusChanged) {
      const word = patch.status === "APPROVED" ? "approved" : patch.status === "REJECTED" ? "rejected" : "set back to pending";
      await audit(ctx, {
        actorId: actor, action: `hostel.${word.replace(/ /g, "_")}`, targetType: "hostel", targetId: id,
        summary: `${existing.hostel_name} ${word}${reason ? `: ${reason.trim()}` : ""}`,
      });
      if (existing.manager_id && (patch.status === "APPROVED" || patch.status === "REJECTED")) {
        const approved = patch.status === "APPROVED";
        await notify(ctx, existing.manager_id, {
          type: approved ? "hostel_approved" : "hostel_rejected",
          title: approved ? "Hostel approved" : "Hostel not approved",
          message: approved
            ? `${existing.hostel_name} was approved and is now live for students.`
            : `${existing.hostel_name} was not approved${reason?.trim() ? `: ${reason.trim()}` : "."}`,
          link: "/manager/properties",
        });
      }
    }
    const updated = await ctx.db.get(hostelId);
    return updated ? toApiRow(updated) : null;
  }
);

export const addImages = secureMutation(
  { hostelId: v.string(), urls: v.array(v.string()), actorId: v.optional(v.string()) },
  async (ctx, { hostelId, urls, actorId }) => {
    const id = ctx.db.normalizeId("hostels", hostelId);
    if (!id) throw new Error("Hostel not found");
    const created = [];
    for (const url of urls) {
      const rowId = await ctx.db.insert("hostelImages", { hostel_id: id, image_url: url });
      created.push(toApiRow((await ctx.db.get(rowId))!));
    }
    if (actorId && urls.length) {
      const hostel = await ctx.db.get(id);
      await audit(ctx, {
        actorId: ctx.db.normalizeId("users", actorId), action: "hostel.photos_added", targetType: "hostel", targetId: hostelId,
        summary: `Added ${urls.length} photo${urls.length === 1 ? "" : "s"} to ${hostel?.hostel_name ?? "a hostel"}`,
      });
    }
    return created;
  }
);

export const removeImage = secureMutation(
  { hostelId: v.string(), imageId: v.string(), actorId: v.optional(v.string()) },
  async (ctx, { hostelId, imageId, actorId }) => {
    const hid = ctx.db.normalizeId("hostels", hostelId);
    const iid = ctx.db.normalizeId("hostelImages", imageId);
    if (!hid || !iid) return false;
    const image = await ctx.db.get(iid);
    // Scoped to the hostel so one manager can't delete another's photo by id.
    if (!image || image.hostel_id !== hid) return false;
    await ctx.db.delete(iid);
    if (actorId) {
      const hostel = await ctx.db.get(hid);
      await audit(ctx, {
        actorId: ctx.db.normalizeId("users", actorId), action: "hostel.photo_removed", targetType: "hostel", targetId: hostelId,
        summary: `Removed a photo from ${hostel?.hostel_name ?? "a hostel"}`,
      });
    }
    return true;
  }
);
