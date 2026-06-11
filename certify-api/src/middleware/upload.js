import multer from "multer";

// Store file in memory (buffer) — parsed by exceljs (xlsx) or csv-parse (csv).
// .xls (legacy binary format) is intentionally not accepted: exceljs doesn't
// support it and no safe open-source parser exists without known vulns.
export const uploadFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(_req, file, cb) {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/csv",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("يُقبل فقط ملفات Excel (.xlsx) أو CSV."));
    }
  },
}).single("file");
