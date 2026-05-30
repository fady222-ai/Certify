// middleware/upload.middleware.js
'use strict';

const multer  = require('multer');
const path    = require('path');
const cfg     = require('../config');
const storage = require('../adapters/storage/local.storage');

storage.ensureDir();

const diskStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, cfg.storage.localDir),
  filename:    (_, file, cb) => {
    const unique = Date.now() + '_' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: diskStorage,
  limits:  { fileSize: cfg.storage.maxSize },
  fileFilter: (_, file, cb) => {
    cfg.allowedMimeTypes.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('نوع الملف غير مسموح'));
  },
});

module.exports = upload;
