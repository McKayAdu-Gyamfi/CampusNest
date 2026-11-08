// server/convex/verifications.ts
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { WhereClause } from "./lib/whereMatch";
import { toApiDoc } from "./lib/toApiDoc";
import { applySort } from "./lib/applySort";
import { secureQuery, secureMutation } from "./lib/secureFunction";

// Verification rows are the one table where better-auth needs comparisons, not just
// equality: before every lookup it sweeps expired rows ("expiresAt < now"), and the
// password-reset flow does a lookup. Equality-only matching made that sweep throw,
// which turned every "forgot password" request into a 500. The other auth tables keep
// the strict equality-only matcher.
const OPERATORS = new Set(["eq", "ne", "lt", "lte", "gt", "gte"]);

function validateWhere(where: WhereClause[]): void {
  for (const clause of where) {
    if (clause.operator && !OPERATORS.has(clause.operator)) {
      throw new Error(`Unsupported where operator "${clause.operator}" on field "${clause.field}" — verifications support eq, ne, lt, lte, gt and gte.`);
    }
  }
}

function compare(actual: any, expected: any, operator = "eq"): boolean {
  switch (operator) {
    case "eq": return actual === expected;
    case "ne": return actual !== expected;
    // A missing value never satisfies an ordering comparison.
    case "lt": return actual !== undefined && actual < expected;
    case "lte": return actual !== undefined && actual <= expected;
    case "gt": return actual !== undefined && actual > expected;
    case "gte": return actual !== undefined && actual >= expected;
    default: return false;
  }
}

function matchesWhere(doc: Record<string, unknown>, where: WhereClause[]): boolean {
  validateWhere(where);
  return where.every((c) => compare(doc[c.field], c.value, c.operator));
}

const whereValidator = v.array(v.object({ field: v.string(), value: v.any(), operator: v.optional(v.string()) }));

async function findMatchRaw(ctx: any, w: WhereClause[]) {
  if (w.length === 1 && w[0].field === "id" && (!w[0].operator || w[0].operator === "eq")) {
    return await ctx.db.get(w[0].value as Id<"verifications">);
  }
  if (w.length === 1 && w[0].field === "identifier" && (!w[0].operator || w[0].operator === "eq")) {
    return await ctx.db
      .query("verifications")
      .withIndex("by_identifier", (q: any) => q.eq("identifier", w[0].value as string))
      .unique();
  }
  const all = await ctx.db.query("verifications").collect();
  return all.find((doc: any) => matchesWhere({ ...doc, id: doc._id }, w)) ?? null;
}

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  const id = await ctx.db.insert("verifications", data);
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
    const all = await ctx.db.query("verifications").collect();
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
