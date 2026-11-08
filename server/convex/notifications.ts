import { v } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";

export const listForUser = secureQuery(
  { userId: v.string(), limit: v.optional(v.number()) },
  async (ctx, { userId, limit }) => {
    const id = ctx.db.normalizeId("users", userId);
    if (!id) return [];
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_id", (q: any) => q.eq("user_id", id))
      .order("desc")
      .take(limit ?? 50);
    return rows.map((r: any) => toApiRow(r));
  }
);

// Scoped to the owner so one user can't mark another's notifications.
export const markRead = secureMutation(
  { id: v.string(), userId: v.string() },
  async (ctx, { id, userId }) => {
    const nid = ctx.db.normalizeId("notifications", id);
    const uid = ctx.db.normalizeId("users", userId);
    if (!nid || !uid) return false;
    const row = await ctx.db.get(nid);
    if (!row || row.user_id !== uid) return false;
    await ctx.db.patch(nid, { read: true });
    return true;
  }
);

export const markAllRead = secureMutation({ userId: v.string() }, async (ctx, { userId }) => {
  const uid = ctx.db.normalizeId("users", userId);
  if (!uid) return 0;
  const rows = await ctx.db
    .query("notifications")
    .withIndex("by_user_id", (q: any) => q.eq("user_id", uid))
    .collect();
  let n = 0;
  for (const r of rows) {
    if (!r.read) { await ctx.db.patch(r._id, { read: true }); n++; }
  }
  return n;
});
