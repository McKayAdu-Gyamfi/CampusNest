import multer from 'multer';

// Use memory storage to avoid saving files to disk since we upload
// directly from the memory buffer to Convex storage.
const storage = multer.memoryStorage();

// Accept only JPEG and PNG files
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG and PNG images are allowed'), false);
  }
};

// Export the middleware configured to handle multiple files
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum file size
  },
});
