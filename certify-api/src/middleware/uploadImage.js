import multer from "multer";

// Logo / signature uploads — kept in memory, then written to the storage dir.
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter(_req, file, cb) {
    // SVG is deliberately excluded: it can embed <script> and would execute as
    // stored XSS when served from /storage. Raster formats only.
    if (/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("يُقبل فقط صور PNG أو JPG أو WebP."));
    }
  },
}).single("file");
