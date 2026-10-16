import { convex } from "./convex.js";

// Every Convex function requires the shared adapter secret (see
// convex/lib/secureFunction.ts). Threading it here keeps it out of all
// ~70 call sites.
const ADAPTER_SECRET = process.env.CONVEX_ADAPTER_SECRET;
if (!ADAPTER_SECRET) {
  throw new Error("CONVEX_ADAPTER_SECRET is not set — the server cannot call its Convex functions");
}

export const cq = (fn, args = {}) => convex.query(fn, { ...args, secret: ADAPTER_SECRET });
export const cm = (fn, args = {}) => convex.mutation(fn, { ...args, secret: ADAPTER_SECRET });
export const ca = (fn, args = {}) => convex.action(fn, { ...args, secret: ADAPTER_SECRET });
