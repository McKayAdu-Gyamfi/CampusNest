import { v } from "convex/values";
import { secureAction } from "./lib/secureFunction";

// Storage needs an action — ctx.storage.store is not available to a
// mutation. upload.middleware.js caps files at 10MB, comfortably inside
// Convex's 16MB function-argument limit.
export const storeImage = secureAction(
  { bytes: v.bytes(), contentType: v.string() },
  async (ctx, { bytes, contentType }) => {
    const storageId = await ctx.storage.store(new Blob([bytes], { type: contentType }));
    const url = await ctx.storage.getUrl(storageId);
    if (!url) {
      throw new Error("Convex storage returned no URL for the stored image");
    }
    return url;
  }
);
