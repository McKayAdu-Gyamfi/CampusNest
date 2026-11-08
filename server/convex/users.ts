import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { matchesWhere, validateWhere, type WhereClause } from "./lib/whereMatch";
import { toApiDoc } from "./lib/toApiDoc";
import { applySort } from "./lib/applySort";
import { secureQuery, secureMutation } from "./lib/secureFunction";
import { toApiRow } from "./lib/toApiRow";
import { audit } from "./lib/audit";

const whereValidator = v.array(v.object({ field: v.string(), value: v.any(), operator: v.optional(v.string()) }));

async function findMatchRaw(ctx: any, w: WhereClause[]) {
  if (w.length === 1 && w[0].field === "id" && (!w[0].operator || w[0].operator === "eq")) {
    return await ctx.db.get(w[0].value as Id<"users">);
  }
  if (w.length === 1 && w[0].field === "email" && (!w[0].operator || w[0].operator === "eq")) {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", w[0].value as string))
      .unique();
  }
  const all = await ctx.db.query("users").collect();
  return all.find((doc: any) => matchesWhere({ ...doc, id: doc._id }, w)) ?? null;
}

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  // Convex indexes aren't unique — without this check, two concurrent
  // sign-ups with the same email both succeed, and every subsequent
  // by-email lookup (.unique()) permanently 500s for that email.
  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", data.email))
    .unique();
  if (existing) {
    throw new Error(`A user with email "${data.email}" already exists`);
  }
  const id = await ctx.db.insert("users", data);
  return { ...data, id };
});

export const findOne = secureQuery({ where: whereValidator }, async (ctx, { where }) => {
  const w = where as WhereClause[];
  validateWhere(w);
  const doc = await findMatchRaw(ctx, w);
  return doc ? toApiDoc(doc) : null;
});

export const findMany = secureQuery(
  { where: whereValidator, limit: v.optional(v.number()), sortBy: v.optional(v.any()) },
  async (ctx, { where, limit, sortBy }) => {
    const w = where as WhereClause[];
    validateWhere(w);
    const all = await ctx.db.query("users").collect();
    const matches = w.length === 0 ? all : all.filter((doc: any) => matchesWhere({ ...doc, id: doc._id }, w));
    const sorted = applySort(matches, sortBy);
    const sliced = limit ? sorted.slice(0, limit) : sorted;
    return sliced.map((doc: any) => toApiDoc(doc));
  }
);

export const update = secureMutation({ where: whereValidator, update: v.any() }, async (ctx, { where, update }) => {
  const w = where as WhereClause[];
  validateWhere(w);
  const match = await findMatchRaw(ctx, w);
  if (!match) return null;
  await ctx.db.patch(match._id, update);
  const updated = await ctx.db.get(match._id);
  return updated ? toApiDoc(updated) : null;
});

export const delete_ = secureMutation({ where: whereValidator }, async (ctx, { where }) => {
  const w = where as WhereClause[];
  validateWhere(w);
  const match = await findMatchRaw(ctx, w);
  if (!match) return;
  await ctx.db.delete(match._id);
});

export { delete_ as delete };

// Business-facing user reads. These use toApiRow (ISO timestamps, `id`),
// unlike the better-auth adapter paths above which use toApiDoc.

export const getMeWithRoom = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const userId = ctx.db.normalizeId("users", id);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;

  const row = toApiRow(user);
  row.ROOM = null;
  if (user.current_room_id) {
    const room = await ctx.db.get(user.current_room_id);
    if (room) {
      const hostel = await ctx.db.get(room.hostel_id);
      row.ROOM = {
        room_number: room.room_number,
        HOSTEL: hostel ? { hostel_name: hostel.hostel_name } : null,
      };
    }
  }
  return row;
});

export const getProfileComplete = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const userId = ctx.db.normalizeId("users", id);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return { profile_complete: user.profile_complete };
});

// Allow-list of patchable fields; unknown keys are silently dropped.
const PATCHABLE_REQUIRED = ["name", "user_type", "profile_complete", "emailVerified"];
const PATCHABLE_OPTIONAL = ["image", "student_id", "course", "payment_details", "current_room_id",
  "phone", "institution", "level", "gender", "date_of_birth", "emergency_contact_name", "emergency_contact_phone",
  "business_name", "ghana_card_number", "payout_method", "momo_network", "momo_number",
  "bank_name", "bank_account_number", "bank_account_name"];

export const updateProfile = secureMutation({ id: v.string(), patch: v.any() }, async (ctx, { id, patch }) => {
  const userId = ctx.db.normalizeId("users", id);
  if (!userId) return null;
  const existing = await ctx.db.get(userId);
  if (!existing) return null;
  const safe: Record<string, any> = {};
  for (const key of PATCHABLE_REQUIRED) {
    if (patch?.[key] !== undefined && patch[key] !== null) safe[key] = patch[key];
  }
  for (const key of PATCHABLE_OPTIONAL) {
    if (patch?.[key] === undefined) continue;
    // null means "clear the field": undefined makes Convex remove the key.
    safe[key] = patch[key] === null ? undefined : patch[key];
  }
  if (typeof safe.current_room_id === "string") {
    const roomId = ctx.db.normalizeId("rooms", safe.current_room_id);
    if (!roomId) throw new Error("Room not found");
    safe.current_room_id = roomId;
  }
  await ctx.db.patch(userId, { ...safe, updatedAt: Date.now() });
  const updated = await ctx.db.get(userId);
  return updated ? toApiRow(updated) : null;
});

export const listAll = secureQuery({}, async (ctx) => {
  const users = await ctx.db.query("users").collect();
  return users.map((u: any) => toApiRow(u));
});

// Reads just the suspension flag: used at sign-in and on every API request.
export const getSuspension = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const userId = ctx.db.normalizeId("users", id);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return { suspended: !!user.suspended_at, reason: user.suspended_reason ?? null };
});

// Suspends or reactivates an account. Suspending also ends every open session
// so it takes effect immediately, not at the next sign-in.
export const setSuspended = secureMutation(
  { id: v.string(), suspended: v.boolean(), reason: v.optional(v.string()), actorId: v.optional(v.string()) },
  async (ctx, { id, suspended, reason, actorId }) => {
    const userId = ctx.db.normalizeId("users", id);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    await ctx.db.patch(userId, {
      suspended_at: suspended ? Date.now() : undefined,
      suspended_reason: suspended ? reason?.trim() || undefined : undefined,
      updatedAt: Date.now(),
    });
    if (suspended) {
      const sessions = await ctx.db.query("sessions").withIndex("by_userId", (q: any) => q.eq("userId", userId)).collect();
      for (const s of sessions) await ctx.db.delete(s._id);
    }
    await audit(ctx, {
      actorId: actorId ? ctx.db.normalizeId("users", actorId) : null,
      action: suspended ? "user.suspended" : "user.reactivated",
      targetType: "user", targetId: id,
      summary: `${user.name || user.email} ${suspended ? "suspended" : "reactivated"}${suspended && reason ? `: ${reason.trim()}` : ""}`,
    });
    return toApiRow((await ctx.db.get(userId))!);
  }
);

// Everything an admin needs to review one account in a single read.
export const adminDetail = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const userId = ctx.db.normalizeId("users", id);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  const row = toApiRow(user);

  const bookings = await ctx.db.query("bookings").withIndex("by_student_id", (q: any) => q.eq("student_id", userId)).collect();
  row.booking_counts = {
    total: bookings.length,
    confirmed: bookings.filter((b: any) => b.status === "CONFIRMED").length,
    pending: bookings.filter((b: any) => b.status === "PENDING").length,
    spent: bookings
      .filter((b: any) => b.status === "CONFIRMED" || b.status === "CHECKED_OUT")
      .reduce((s: number, b: any) => s + (b.amount_paid ?? 0), 0),
  };
  const hostels = await ctx.db.query("hostels").withIndex("by_manager_id", (q: any) => q.eq("manager_id", userId)).collect();
  row.hostels = hostels.map((h: any) => ({ id: h._id, hostel_name: h.hostel_name, status: h.status }));
  return row;
});
