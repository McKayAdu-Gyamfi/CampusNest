import { v } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery } from "./lib/secureFunction";

// Newest first, with the actor's name so the log reads on its own.
export const list = secureQuery({ limit: v.optional(v.number()) }, async (ctx, { limit }) => {
  const rows = await ctx.db.query("auditLogs").withIndex("by_created_at").order("desc").take(Math.min(limit ?? 100, 500));
  return await Promise.all(
    rows.map(async (r: any) => {
      const actor = await ctx.db.get(r.actor_id);
      const row = toApiRow(r);
      row.actor = actor ? { id: actor._id, name: actor.name, email: actor.email } : null;
      return row;
    })
  );
});
