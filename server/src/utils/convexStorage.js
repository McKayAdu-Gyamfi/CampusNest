import { convex } from '../config/db.js';
import crypto from 'crypto';

/**
 * Note: Convex storage uploads happen via HTTP POST directly to an upload URL.
 * The Express backend can either forward this, or upload it directly.
 * 
 * @param {Object} file - The file object from multer (must contain buffer, originalname, mimetype)
 * @returns {Promise<string>} - The Convex storage ID (which can be used to generate a URL)
 */
export const uploadImageToConvex = async (file) => {
  // 1. Generate an upload URL from Convex
  const uploadUrl = await convex.mutation("storage:generateUploadUrl");

  // 2. Upload the file buffer to the generated URL
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.mimetype },
    body: file.buffer,
  });

  if (!response.ok) {
    throw new Error(`Convex upload error: ${response.statusText}`);
  }

  // 3. Get the storage ID
  const { storageId } = await response.json();
  
  // Note: To get the public URL, use ctx.storage.getUrl(storageId) inside Convex, 
  // or store the storageId directly. 
  // For now, we return the storageId to be saved in the database.
  return storageId;
};
