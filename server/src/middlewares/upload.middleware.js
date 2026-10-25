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

// Equirectangular panoramas are routinely larger than the 10MB a hostel or
// room photo needs, so the tour-generation route gets its own, higher cap.
// It deliberately reuses the same memory storage and mimetype allowlist —
// only the size limit differs. 20MB exceeds Convex's 16MB function-argument
// limit, which is why that route stores through uploadLargeFileToConvex's
// upload-URL flow rather than passing bytes as an argument.
export const panoramaUploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB maximum panorama size
  },
});
