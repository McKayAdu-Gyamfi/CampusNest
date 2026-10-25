import { v } from "convex/values";
import { secureAction, secureMutation, secureQuery } from "./lib/secureFunction";

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

// The two functions below exist for files too large to pass as a function
// argument. storeImage takes v.bytes(), and Convex caps a function's
// arguments at 16MB — which base64 transport inflates further — so an
// equirectangular panorama (up to 20MB via panoramaUploadMiddleware) has
// to be POSTed directly to a short-lived upload URL instead of travelling
// as an argument. See uploadLargeFileToConvex in src/utils/convexStorage.js
// for the three-step flow that drives these.
//
// Neither can be exercised by convex-test, whose harness implements
// storeBlob but not storage/generateUploadUrl, so they are verified
// against the live deployment instead; the orchestration around them lives
// in Express precisely so it can be unit-tested.
export const generateUploadUrl = secureMutation({}, async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const getStorageUrl = secureQuery({ storageId: v.string() }, async (ctx, { storageId }) => {
  const url = await ctx.storage.getUrl(storageId as any);
  if (!url) {
    throw new Error(`Convex storage holds no file for id ${storageId}`);
  }
  return url;
});

// Convex offers no CLI for storage, and before this there was no way to
// remove a stored file at all — which is why a failed multi-file upload
// left orphans with no row referencing them. These two close that gap, and
// are the only path to deleting a file the app no longer needs.
export const listStoredFiles = secureQuery({}, async (ctx) => {
  const files = await ctx.db.system.query("_storage").collect();
  return files.map((f: any) => ({
    id: f._id,
    size: f.size,
    contentType: f.contentType ?? null,
    created_at: new Date(f._creationTime).toISOString(),
  }));
});

export const deleteStoredFile = secureMutation({ storageId: v.string() }, async (ctx, { storageId }) => {
  await ctx.storage.delete(storageId as any);
  return { success: true };
});
