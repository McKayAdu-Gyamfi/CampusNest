import { createAdapterFactory } from "better-auth/adapters";
import { convex } from "./src/config/convex.js";
import { api } from "./convex/_generated/api.js";

// Every one of the 20 Convex functions this adapter calls is a PUBLIC
// query/mutation — reachable by anyone with the deployment URL (which ends
// up in the client bundle the moment anything imports it), no better-auth
// session or Express middleware involved at all. This secret is the ONLY
// thing standing between "only this server can call these" and "anyone on
// the internet can read every session token / password hash, or grant
// themselves ADMIN" — confirmed exploitable during this plan's final
// review. Set via `npx convex env set CONVEX_ADAPTER_SECRET <value>`
// (deployment side) and mirrored in server/.env (app side); both sides
// must match or every call fails closed.
const ADAPTER_SECRET = process.env.CONVEX_ADAPTER_SECRET;
if (!ADAPTER_SECRET) {
  throw new Error("CONVEX_ADAPTER_SECRET is not set — the Convex functions this adapter calls would reject every request");
}

const MODEL_TO_API = {
  user: api.users,
  session: api.sessions,
  account: api.accounts,
  verification: api.verifications,
};

function fnsFor(model) {
  const fns = MODEL_TO_API[model];
  if (!fns) {
    throw new Error(`convexAdapter: no Convex functions registered for model "${model}"`);
  }
  return fns;
}

// Convex's query/mutation argument validators only accept {field, value,
// operator} — better-auth's adapter factory always adds a `connector`
// ("AND"/"OR", defaulted even when the caller never set one) to every
// where-clause entry, which Convex rejects outright as an unrecognized
// extra field (confirmed against the real factory source:
// node_modules/@better-auth/core/dist/db/adapter/factory.mjs's
// transformWhereClause always returns {operator, connector, field, value}).
// This adapter's matcher only ever supports AND semantics (lib/whereMatch.ts)
// — an "OR" connector silently passed through would produce wrong results,
// so reject it explicitly rather than just dropping it.
function stripConnector(where) {
  return (where ?? []).map(({ field, value, operator, connector }) => {
    if (connector && connector !== "AND") {
      throw new Error(`convexAdapter: unsupported where connector "${connector}" — only AND is supported`);
    }
    return operator !== undefined ? { field, value, operator } : { field, value };
  });
}

export function convexAdapter() {
  return createAdapterFactory({
    config: {
      adapterId: "convex",
      adapterName: "Convex Adapter",
      // Convex's own _id is a string, not better-auth's generated id scheme.
      supportsNumericIds: false,
      supportsDates: true,
      supportsBooleans: true,
      supportsJSON: false,
      // Convex owns id generation via its own _id — without this,
      // better-auth generates its own 32-char id for every create() and
      // expects the adapter to persist it as a literal `id` field (which
      // doesn't exist in the Convex schema) and to use it as the foreign
      // key value on related records (e.g. account.userId), which isn't a
      // valid Convex Id<"users">.
      disableIdGeneration: true,
      // Convex has no native Date type (and no "null" for an optional
      // field — v.optional() only accepts the key being absent). These two
      // hooks run for every field the adapter factory already knows about
      // (built-in fields like createdAt/expiresAt, and our registered
      // additionalFields like user_type/payment_details alike), in both
      // directions: create/update payloads going IN, and findOne/findMany
      // results coming OUT. Returning `undefined` from customTransformInput
      // drops that key from the payload entirely (the factory's own
      // pipeline only assigns `transformedData[field] = newValue` when
      // `newValue !== undefined`).
      customTransformInput: ({ data, fieldAttributes }) => {
        if (data === null) return undefined;
        if (fieldAttributes.type === "date" && data instanceof Date) return data.getTime();
        return data;
      },
      customTransformOutput: ({ data, fieldAttributes }) => {
        if (fieldAttributes.type === "date" && typeof data === "number") return new Date(data);
        return data;
      },
    },
    adapter: () => ({
      create: async ({ model, data }) => {
        return await convex.mutation(fnsFor(model).create, { data, secret: ADAPTER_SECRET });
      },
      findOne: async ({ model, where }) => {
        return await convex.query(fnsFor(model).findOne, { where: stripConnector(where), secret: ADAPTER_SECRET });
      },
      findMany: async ({ model, where, limit, sortBy }) => {
        return await convex.query(fnsFor(model).findMany, { where: stripConnector(where), limit, sortBy, secret: ADAPTER_SECRET });
      },
      update: async ({ model, where, update }) => {
        return await convex.mutation(fnsFor(model).update, { where: stripConnector(where), update, secret: ADAPTER_SECRET });
      },
      // updateMany/deleteMany/count aren't backed by their own Convex
      // functions (Tasks 3-6 only built single-record update/delete) —
      // composed here from findMany + the existing single-record
      // mutations instead, since better-auth's email/password flow
      // never issues bulk operations and these exist only to satisfy
      // createAdapterFactory's required interface.
      updateMany: async ({ model, where, update }) => {
        const matches = await convex.query(fnsFor(model).findMany, { where: stripConnector(where), secret: ADAPTER_SECRET });
        for (const doc of matches) {
          await convex.mutation(fnsFor(model).update, { where: [{ field: "id", value: doc.id }], update, secret: ADAPTER_SECRET });
        }
        return matches.length;
      },
      delete: async ({ model, where }) => {
        await convex.mutation(fnsFor(model).delete, { where: stripConnector(where), secret: ADAPTER_SECRET });
      },
      deleteMany: async ({ model, where }) => {
        const matches = await convex.query(fnsFor(model).findMany, { where: stripConnector(where), secret: ADAPTER_SECRET });
        for (const doc of matches) {
          await convex.mutation(fnsFor(model).delete, { where: [{ field: "id", value: doc.id }], secret: ADAPTER_SECRET });
        }
        return matches.length;
      },
      count: async ({ model, where }) => {
        const matches = await convex.query(fnsFor(model).findMany, { where: stripConnector(where), secret: ADAPTER_SECRET });
        return matches.length;
      },
    }),
  });
}
