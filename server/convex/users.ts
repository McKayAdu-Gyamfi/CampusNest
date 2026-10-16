import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { matchesWhere, validateWhere, type WhereClause } from "./lib/whereMatch";
import { toApiDoc } from "./lib/toApiDoc";
import { applySort } from "./lib/applySort";
import { secureQuery, secureMutation } from "./lib/secureFunction";
import { toApiRow } from "./lib/toApiRow";

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
const PATCHABLE_OPTIONAL = ["image", "student_id", "course", "payment_details", "current_room_id"];

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
