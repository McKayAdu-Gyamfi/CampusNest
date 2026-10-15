import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { matchesWhere, validateWhere, type WhereClause } from "./lib/whereMatch";

const whereValidator = v.array(v.object({ field: v.string(), value: v.any(), operator: v.optional(v.string()) }));

export const create = mutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    const id = await ctx.db.insert("users", data);
    return { ...data, id };
  },
});

export const findOne = query({
  args: { where: whereValidator },
  handler: async (ctx, { where }) => {
    const w = where as WhereClause[];
    validateWhere(w);

    if (w.length === 1 && w[0].field === "id" && (!w[0].operator || w[0].operator === "eq")) {
      const doc = await ctx.db.get(w[0].value as Id<"users">);
      return doc ? { ...doc, id: doc._id } : null;
    }

    if (w.length === 1 && w[0].field === "email" && (!w[0].operator || w[0].operator === "eq")) {
      const doc = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", w[0].value as string))
        .unique();
      return doc ? { ...doc, id: doc._id } : null;
    }

    const all = await ctx.db.query("users").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    return match ? { ...match, id: match._id } : null;
  },
});

export const findMany = query({
  args: { where: whereValidator, limit: v.optional(v.number()), sortBy: v.optional(v.any()) },
  handler: async (ctx, { where, limit }) => {
    const w = where as WhereClause[];
    validateWhere(w);
    const all = await ctx.db.query("users").collect();
    const matches = w.length === 0 ? all : all.filter((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    const sliced = limit ? matches.slice(0, limit) : matches;
    return sliced.map((doc) => ({ ...doc, id: doc._id }));
  },
});

export const update = mutation({
  args: { where: whereValidator, update: v.any() },
  handler: async (ctx, { where, update }) => {
    const w = where as WhereClause[];
    validateWhere(w);
    const all = await ctx.db.query("users").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    if (!match) return null;
    await ctx.db.patch(match._id, update);
    const updated = await ctx.db.get(match._id);
    return updated ? { ...updated, id: updated._id } : null;
  },
});

export const delete_ = mutation({
  args: { where: whereValidator },
  handler: async (ctx, { where }) => {
    const w = where as WhereClause[];
    validateWhere(w);
    const all = await ctx.db.query("users").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    if (!match) return;
    await ctx.db.delete(match._id);
  },
});

export { delete_ as delete };
