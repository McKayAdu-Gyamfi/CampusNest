// server/convex/verifications.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { matchesWhere, validateWhere, type WhereClause } from "./lib/whereMatch";
import { toApiDoc } from "./lib/toApiDoc";

const whereValidator = v.array(v.object({ field: v.string(), value: v.any(), operator: v.optional(v.string()) }));

export const create = mutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    const id = await ctx.db.insert("verifications", data);
    return { ...data, id };
  },
});

export const findOne = query({
  args: { where: whereValidator },
  handler: async (ctx, { where }) => {
    const w = where as WhereClause[];
    validateWhere(w);

    if (w.length === 1 && w[0].field === "id" && (!w[0].operator || w[0].operator === "eq")) {
      const doc = await ctx.db.get(w[0].value as Id<"verifications">);
      return doc ? toApiDoc(doc) : null;
    }

    if (w.length === 1 && w[0].field === "identifier" && (!w[0].operator || w[0].operator === "eq")) {
      const doc = await ctx.db
        .query("verifications")
        .withIndex("by_identifier", (q) => q.eq("identifier", w[0].value as string))
        .unique();
      return doc ? toApiDoc(doc) : null;
    }

    const all = await ctx.db.query("verifications").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    return match ? toApiDoc(match) : null;
  },
});

export const findMany = query({
  args: { where: whereValidator, limit: v.optional(v.number()), sortBy: v.optional(v.any()) },
  handler: async (ctx, { where, limit }) => {
    const w = where as WhereClause[];
    validateWhere(w);
    const all = await ctx.db.query("verifications").collect();
    const matches = w.length === 0 ? all : all.filter((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    const sliced = limit ? matches.slice(0, limit) : matches;
    return sliced.map((doc) => toApiDoc(doc));
  },
});

export const update = mutation({
  args: { where: whereValidator, update: v.any() },
  handler: async (ctx, { where, update }) => {
    const w = where as WhereClause[];
    validateWhere(w);
    const all = await ctx.db.query("verifications").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    if (!match) return null;
    await ctx.db.patch(match._id, update);
    const updated = await ctx.db.get(match._id);
    return updated ? toApiDoc(updated) : null;
  },
});

export const delete_ = mutation({
  args: { where: whereValidator },
  handler: async (ctx, { where }) => {
    const w = where as WhereClause[];
    validateWhere(w);
    const all = await ctx.db.query("verifications").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    if (!match) return;
    await ctx.db.delete(match._id);
  },
});

export { delete_ as delete };
