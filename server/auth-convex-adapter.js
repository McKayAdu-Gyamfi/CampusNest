import { createAdapterFactory } from "better-auth/adapters";
import { convex } from "./src/config/convex.js";
import { api } from "./convex/_generated/api.js";

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
    },
    adapter: () => ({
      create: async ({ model, data }) => {
        return await convex.mutation(fnsFor(model).create, { data });
      },
      findOne: async ({ model, where }) => {
        return await convex.query(fnsFor(model).findOne, { where });
      },
      findMany: async ({ model, where, limit, sortBy }) => {
        return await convex.query(fnsFor(model).findMany, { where: where ?? [], limit, sortBy });
      },
      update: async ({ model, where, update }) => {
        return await convex.mutation(fnsFor(model).update, { where, update });
      },
      // updateMany/deleteMany/count aren't backed by their own Convex
      // functions (Tasks 3-6 only built single-record update/delete) —
      // composed here from findMany + the existing single-record
      // mutations instead, since better-auth's email/password flow
      // never issues bulk operations and these exist only to satisfy
      // createAdapterFactory's required interface.
      updateMany: async ({ model, where, update }) => {
        const matches = await convex.query(fnsFor(model).findMany, { where: where ?? [] });
        for (const doc of matches) {
          await convex.mutation(fnsFor(model).update, { where: [{ field: "id", value: doc.id }], update });
        }
        return matches.length;
      },
      delete: async ({ model, where }) => {
        await convex.mutation(fnsFor(model).delete, { where });
      },
      deleteMany: async ({ model, where }) => {
        const matches = await convex.query(fnsFor(model).findMany, { where: where ?? [] });
        for (const doc of matches) {
          await convex.mutation(fnsFor(model).delete, { where: [{ field: "id", value: doc.id }] });
        }
        return matches.length;
      },
      count: async ({ model, where }) => {
        const matches = await convex.query(fnsFor(model).findMany, { where: where ?? [] });
        return matches.length;
      },
    }),
  });
}
