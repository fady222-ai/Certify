import multer from "multer";

// Store file in memory (buffer) — parsed by exceljs (xlsx) or csv-parse (csv).
// .xls (legacy binary format) is intentionally not accepted: exceljs doesn't
// support it and no safe open-source parser exists without known vulns.
export const uploadFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(_req, file, cb) {
    // Require a recognized extension (the client-supplied MIME is spoofable, so
    // it's necessary but not sufficient). The buffer is parsed by exceljs/
    // csv-parse and never written to disk or served, so content drives behavior;
    // this filter is the first cheap gate. A recognized MIME is also accepted to
    // tolerate Excel exports that send the right type with an odd name.
    const allowedMime = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel", // some browsers tag .csv with this
    ];
    const hasExt = /\.(xlsx|csv)$/i.test(file.originalname);
    if (hasExt || allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("يُقبل فقط ملفات Excel (.xlsx) أو CSV."));
    }
  },
}).single("file");
