// server/convex/accounts.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { matchesWhere, validateWhere, type WhereClause } from "./lib/whereMatch";
import { toApiDoc } from "./lib/toApiDoc";

const whereValidator = v.array(v.object({ field: v.string(), value: v.any(), operator: v.optional(v.string()) }));

function isProviderAccountComposite(w: WhereClause[]) {
  if (w.length !== 2) return null;
  const providerClause = w.find((c) => c.field === "providerId" && (!c.operator || c.operator === "eq"));
  const accountClause = w.find((c) => c.field === "accountId" && (!c.operator || c.operator === "eq"));
  if (!providerClause || !accountClause) return null;
  return { providerId: providerClause.value as string, accountId: accountClause.value as string };
}

export const create = mutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    const id = await ctx.db.insert("accounts", data);
    return { ...data, id };
  },
});

export const findOne = query({
  args: { where: whereValidator },
  handler: async (ctx, { where }) => {
    const w = where as WhereClause[];
    validateWhere(w);

    if (w.length === 1 && w[0].field === "id" && (!w[0].operator || w[0].operator === "eq")) {
      const doc = await ctx.db.get(w[0].value as Id<"accounts">);
      return doc ? toApiDoc(doc) : null;
    }

    const composite = isProviderAccountComposite(w);
    if (composite) {
      const doc = await ctx.db
        .query("accounts")
        .withIndex("by_providerId_accountId", (q) => q.eq("providerId", composite.providerId).eq("accountId", composite.accountId))
        .unique();
      return doc ? toApiDoc(doc) : null;
    }

    const all = await ctx.db.query("accounts").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    return match ? toApiDoc(match) : null;
  },
});

export const findMany = query({
  args: { where: whereValidator, limit: v.optional(v.number()), sortBy: v.optional(v.any()) },
  handler: async (ctx, { where, limit }) => {
    const w = where as WhereClause[];
    validateWhere(w);

    if (w.length === 1 && w[0].field === "userId" && (!w[0].operator || w[0].operator === "eq")) {
      const docs = await ctx.db
        .query("accounts")
        .withIndex("by_userId", (q) => q.eq("userId", w[0].value as Id<"users">))
        .collect();
      const sliced = limit ? docs.slice(0, limit) : docs;
      return sliced.map((doc) => toApiDoc(doc));
    }

    const all = await ctx.db.query("accounts").collect();
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
    const all = await ctx.db.query("accounts").collect();
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
    const all = await ctx.db.query("accounts").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    if (!match) return;
    await ctx.db.delete(match._id);
  },
});

export { delete_ as delete };
