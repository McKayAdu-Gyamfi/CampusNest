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
  return {
    id: "convex",
    async create({ model, data }) {
      return await convex.mutation(fnsFor(model).create, { data });
    },
    async findOne({ model, where }) {
      return await convex.query(fnsFor(model).findOne, { where });
    },
    async findMany({ model, where, limit, sortBy }) {
      return await convex.query(fnsFor(model).findMany, { where: where ?? [], limit, sortBy });
    },
    async update({ model, where, update }) {
      return await convex.mutation(fnsFor(model).update, { where, update });
    },
    async delete({ model, where }) {
      await convex.mutation(fnsFor(model).delete, { where });
    },
  };
}
