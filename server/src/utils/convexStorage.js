import { ca, cq, cm } from "../config/convexClient.js";
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

/**
 * Stores a file too large to pass as a Convex function argument, via
 * Convex's upload-URL flow, and returns its public URL.
 *
 * storeImage above sends the bytes as a v.bytes() argument, which Convex
 * caps at 16MB per call. A panorama may be up to 20MB, so it is POSTed
 * straight to a short-lived upload URL instead and never becomes an
 * argument. The three steps are: ask Convex for an upload URL, POST the
 * bytes to it (Convex replies with a storageId), then resolve that id to
 * a public URL.
 *
 * @param {Buffer} buffer raw file bytes
 * @param {string} contentType sent as the POST's Content-Type; Convex
 *   stores it and serves it back on GET
 * @returns {Promise<string>} the stored file's public URL
 */
export const uploadLargeFileToConvex = async (buffer, contentType) => {
  const uploadUrl = await cm(api.files.generateUploadUrl, {});

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: buffer,
  });

  if (!response.ok) {
    throw new Error(`Convex storage upload failed with HTTP ${response.status}`);
  }

  const { storageId } = await response.json();
  if (!storageId) {
    throw new Error("Convex storage upload returned no storageId");
  }

  return await cq(api.files.getStorageUrl, { storageId });
};
