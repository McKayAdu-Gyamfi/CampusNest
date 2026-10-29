import { v } from "convex/values";
import { secureQuery, secureMutation } from "./lib/secureFunction";

// Values the admin UI showed hardcoded before settings were persisted. A
// deployment that has never saved settings reads these.
export const DEFAULT_SETTINGS = {
  platform_name: "KayaCampus",
  support_email: "support@kayacampus.com",
  maintenance_mode: false,
};

export async function readSettings(ctx: any) {
  const row = await ctx.db.query("settings").first();
  if (!row) return { ...DEFAULT_SETTINGS, updated_at: null };
  return {
    platform_name: row.platform_name,
    support_email: row.support_email,
    maintenance_mode: row.maintenance_mode,
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

export const get = secureQuery({}, async (ctx) => readSettings(ctx));

export const update = secureMutation(
  {
    platform_name: v.optional(v.string()),
    support_email: v.optional(v.string()),
    maintenance_mode: v.optional(v.boolean()),
  },
  async (ctx, patch) => {
    const clean: Record<string, any> = {};
    for (const key of ["platform_name", "support_email", "maintenance_mode"]) {
      if (patch[key] !== undefined) clean[key] = patch[key];
    }
    const now = Date.now();
    const row = await ctx.db.query("settings").first();
    if (row) {
      await ctx.db.patch(row._id, { ...clean, updated_at: now });
    } else {
      await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, ...clean, updated_at: now });
    }
    return await readSettings(ctx);
  }
);
