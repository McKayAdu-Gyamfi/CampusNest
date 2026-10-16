import { query, mutation, action } from "../_generated/server";
import { v } from "convex/values";

// Every query/mutation Convex exposes from this directory is PUBLIC by
// default — reachable by anyone who has the deployment URL, no better-auth
// session or Express middleware involved at all. This app's auth adapter is
// the ONLY intended caller. Without this guard, anyone could read every
// session token or password hash, or grant themselves ADMIN via a raw
// users:update call — confirmed live during the final review.
//
// secureQuery/secureMutation wrap Convex's own query()/mutation() builders,
// injecting a required `secret: v.string()` argument and checking it
// against CONVEX_ADAPTER_SECRET (set via `npx convex env set`, mirrored in
// server/.env) before the real handler ever runs. The adapter
// (auth-convex-adapter.js) passes this secret on every call.
function checkSecret(secret: string): void {
  const expected = process.env.CONVEX_ADAPTER_SECRET;
  if (!expected) {
    throw new Error("CONVEX_ADAPTER_SECRET is not configured on this deployment");
  }
  if (secret.length !== expected.length || secret !== expected) {
    throw new Error("Unauthorized: invalid adapter secret");
  }
}

export function secureQuery(args: Record<string, any>, handler: (ctx: any, args: any) => any) {
  return query({
    args: { ...args, secret: v.string() },
    handler: async (ctx: any, allArgs: any) => {
      const { secret, ...rest } = allArgs;
      checkSecret(secret);
      return await handler(ctx, rest);
    },
  });
}

export function secureMutation(args: Record<string, any>, handler: (ctx: any, args: any) => any) {
  return mutation({
    args: { ...args, secret: v.string() },
    handler: async (ctx: any, allArgs: any) => {
      const { secret, ...rest } = allArgs;
      checkSecret(secret);
      return await handler(ctx, rest);
    },
  });
}

// File storage needs an action (ctx.storage.store is not available in a
// mutation), so it needs its own wrapper — secureQuery/secureMutation
// wrap the query/mutation builders specifically.
export function secureAction(args: Record<string, any>, handler: (ctx: any, args: any) => any) {
  return action({
    args: { ...args, secret: v.string() },
    handler: async (ctx: any, allArgs: any) => {
      const { secret, ...rest } = allArgs;
      checkSecret(secret);
      return await handler(ctx, rest);
    },
  });
}
