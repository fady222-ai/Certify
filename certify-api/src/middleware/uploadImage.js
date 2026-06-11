import multer from "multer";

// Logo / signature uploads — kept in memory, then written to the storage dir.
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter(_req, file, cb) {
    if (/^image\/(png|jpe?g|svg\+xml|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("يُقبل فقط صور PNG أو JPG أو SVG أو WebP."));
    }
  },
}).single("file");
