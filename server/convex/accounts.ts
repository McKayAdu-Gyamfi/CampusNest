// server/convex/accounts.ts
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { matchesWhere, validateWhere, type WhereClause } from "./lib/whereMatch";
import { toApiDoc } from "./lib/toApiDoc";
import { secureQuery, secureMutation } from "./lib/secureFunction";

const whereValidator = v.array(v.object({ field: v.string(), value: v.any(), operator: v.optional(v.string()) }));

function isProviderAccountComposite(w: WhereClause[]) {
  if (w.length !== 2) return null;
  const providerClause = w.find((c) => c.field === "providerId" && (!c.operator || c.operator === "eq"));
  const accountClause = w.find((c) => c.field === "accountId" && (!c.operator || c.operator === "eq"));
  if (!providerClause || !accountClause) return null;
  return { providerId: providerClause.value as string, accountId: accountClause.value as string };
}

async function findMatchRaw(ctx: any, w: WhereClause[]) {
  if (w.length === 1 && w[0].field === "id" && (!w[0].operator || w[0].operator === "eq")) {
    return await ctx.db.get(w[0].value as Id<"accounts">);
  }
  const composite = isProviderAccountComposite(w);
  if (composite) {
    return await ctx.db
      .query("accounts")
      .withIndex("by_providerId_accountId", (q: any) => q.eq("providerId", composite.providerId).eq("accountId", composite.accountId))
      .unique();
  }
  const all = await ctx.db.query("accounts").collect();
  return all.find((doc: any) => matchesWhere({ ...doc, id: doc._id }, w)) ?? null;
}

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  // Convex indexes aren't unique — without this check, two concurrent
  // account-link attempts for the same provider+accountId both succeed,
  // and the by_providerId_accountId .unique() lookup permanently 500s
  // for that pair afterward.
  const existing = await ctx.db
    .query("accounts")
    .withIndex("by_providerId_accountId", (q: any) => q.eq("providerId", data.providerId).eq("accountId", data.accountId))
    .unique();
  if (existing) {
    throw new Error(`An account with providerId "${data.providerId}" and accountId "${data.accountId}" already exists`);
  }
  const id = await ctx.db.insert("accounts", data);
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
      throw new Error("convex accounts.findMany: sortBy is not supported by this adapter");
    }
    const w = where as WhereClause[];
    validateWhere(w);

    if (w.length === 1 && w[0].field === "userId" && (!w[0].operator || w[0].operator === "eq")) {
      const docs = await ctx.db
        .query("accounts")
        .withIndex("by_userId", (q: any) => q.eq("userId", w[0].value as Id<"users">))
        .collect();
      const sliced = limit ? docs.slice(0, limit) : docs;
      return sliced.map((doc: any) => toApiDoc(doc));
    }

    const all = await ctx.db.query("accounts").collect();
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
