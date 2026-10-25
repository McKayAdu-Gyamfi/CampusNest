import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { securePanoMutation } from "./lib/secureFunction";

// Tiled panorama storage for the temp-pano-api service.
//
// Pannellum's multiRes config addresses tiles through a path template
// ("/%l/%s%y_%x") resolved against a basePath, but Convex storage has no
// paths — every file gets an opaque, unrelated id. These functions plus the
// /tour/ route in http.ts bridge that: the pano service uploads each tile
// and registers the relative path Pannellum will ask for, and the route
// resolves path → storage id on request.
//
// All of this is gated by PANO_CONVEX_SECRET, not the adapter secret, so a
// compromised pano service cannot touch the auth or business tables.

export const generateTourUploadUrl = securePanoMutation({}, async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const registerTourFile = securePanoMutation(
  { tourId: v.string(), path: v.string(), storageId: v.string() },
  async (ctx, { tourId, path, storageId }) => {
    // Normalise so a leading slash or a Windows separator from os.walk
    // cannot produce two rows the route would never find.
    const normalisedPath = path.replace(/\\/g, "/").replace(/^\/+/, "");

    // Re-registering a path replaces it, and the file it used to point at
    // is deleted — otherwise regenerating a tour would silently accumulate
    // orphaned tiles that nothing can ever reach or remove.
    const existing = await ctx.db
      .query("tourFiles")
      .withIndex("by_tour_id_path", (q: any) => q.eq("tour_id", tourId).eq("path", normalisedPath))
      .unique();

    if (existing) {
      if (existing.storage_id !== storageId) {
        await ctx.storage.delete(existing.storage_id as any);
      }
      await ctx.db.patch(existing._id, { storage_id: storageId });
      return { path: normalisedPath, replaced: true };
    }

    await ctx.db.insert("tourFiles", {
      tour_id: tourId,
      path: normalisedPath,
      storage_id: storageId,
    });
    return { path: normalisedPath, replaced: false };
  }
);

// internalQuery, not secureQuery: this is called by the /tour/ HTTP action,
// which has no secret to present and must not be given one. internalQuery
// is unreachable from any client, so the route is the only caller.
export const lookupTourFile = internalQuery({
  args: { tourId: v.string(), path: v.string() },
  handler: async (ctx, { tourId, path }) => {
    const row = await ctx.db
      .query("tourFiles")
      .withIndex("by_tour_id_path", (q) => q.eq("tour_id", tourId).eq("path", path))
      .unique();
    return row ? { storageId: row.storage_id } : null;
  },
});
