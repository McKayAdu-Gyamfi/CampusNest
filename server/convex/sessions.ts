// server/convex/sessions.ts
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { matchesWhere, validateWhere, type WhereClause } from "./lib/whereMatch";
import { toApiDoc } from "./lib/toApiDoc";
import { applySort } from "./lib/applySort";
import { secureQuery, secureMutation } from "./lib/secureFunction";

const whereValidator = v.array(v.object({ field: v.string(), value: v.any(), operator: v.optional(v.string()) }));

async function findMatchRaw(ctx: any, w: WhereClause[]) {
  if (w.length === 1 && w[0].field === "id" && (!w[0].operator || w[0].operator === "eq")) {
    return await ctx.db.get(w[0].value as Id<"sessions">);
  }
  if (w.length === 1 && w[0].field === "token" && (!w[0].operator || w[0].operator === "eq")) {
    return await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", w[0].value as string))
      .unique();
  }
  const all = await ctx.db.query("sessions").collect();
  return all.find((doc: any) => matchesWhere({ ...doc, id: doc._id }, w)) ?? null;
}

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  const id = await ctx.db.insert("sessions", data);
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

    if (w.length === 1 && w[0].field === "userId" && (!w[0].operator || w[0].operator === "eq")) {
      const docs = await ctx.db
        .query("sessions")
        .withIndex("by_userId", (q: any) => q.eq("userId", w[0].value as Id<"users">))
        .collect();
      const sorted = applySort(docs, sortBy);
      const sliced = limit ? sorted.slice(0, limit) : sorted;
      return sliced.map((doc: any) => toApiDoc(doc));
    }

    const all = await ctx.db.query("sessions").collect();
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
