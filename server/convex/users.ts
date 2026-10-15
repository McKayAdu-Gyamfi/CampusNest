import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { matchesWhere, validateWhere, type WhereClause } from "./lib/whereMatch";
import { toApiDoc } from "./lib/toApiDoc";
import { secureQuery, secureMutation } from "./lib/secureFunction";

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
    if (sortBy !== undefined) {
      throw new Error("convex users.findMany: sortBy is not supported by this adapter");
    }
    const w = where as WhereClause[];
    validateWhere(w);
    const all = await ctx.db.query("users").collect();
    const matches = w.length === 0 ? all : all.filter((doc: any) => matchesWhere({ ...doc, id: doc._id }, w));
    const sliced = limit ? matches.slice(0, limit) : matches;
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
