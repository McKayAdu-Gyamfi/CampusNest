import { supabase } from '../config/db.js';
import crypto from 'crypto';

/**
 * Uploads a file buffer to a Supabase bucket.
 * 
 * @param {Object} file - The file object from multer (must contain buffer, originalname, mimetype)
 * @param {string} bucketName - The Supabase storage bucket name
 * @param {string} folderPath - Optional folder path within the bucket (e.g., 'hostels/123')
 * @returns {Promise<string>} - The public URL of the uploaded image
 */
// Derived from the validated mimetype (upload.middleware.js only allows these
// two), never from the client-supplied originalname — that field is fully
// attacker-controlled and using it to build a path/extension allowed a
// crafted filename (e.g. containing "../") to escape the intended folder.
const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export const uploadImageToSupabase = async (file, bucketName, folderPath = '') => {
  // Generate a unique file name
  const fileExtension = MIME_EXTENSIONS[file.mimetype] || 'bin';
  const randomName = crypto.randomBytes(16).toString('hex');
  const fileName = `${randomName}.${fileExtension}`;
  
  // Construct full path
  const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload error: ${error.message}`);
  }

  // Retrieve public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
};
