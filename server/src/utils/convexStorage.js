import { ca } from "../config/convexClient.js";
import { api } from "../../convex/_generated/api.js";

// Validated against the mimetype upload.middleware.js already allows,
// never the client-supplied originalname — that field is attacker
// controlled, and the old Supabase helper used it to build a path.
// Convex storage has no folders, so the bucket/folder arguments the old
// uploadImageToSupabase took are gone.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export const uploadImageToConvex = async (file) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new Error(`Unsupported image type: ${file.mimetype}`);
  }

  // multer gives a Node Buffer; Convex's v.bytes() wants an ArrayBuffer of
  // exactly this file's bytes, so slice at the buffer's own offsets rather
  // than handing over the whole backing pool.
  const bytes = file.buffer.buffer.slice(
    file.buffer.byteOffset,
    file.buffer.byteOffset + file.buffer.byteLength
  );

  return await ca(api.files.storeImage, { bytes, contentType: file.mimetype });
};
