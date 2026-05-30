// adapters/storage/local.storage.js
// تخزين الملفات محلياً — قابل للاستبدال بـ Cloudinary أو S3
'use strict';

const fs   = require('fs');
const path = require('path');
const cfg  = require('../../config');

// التأكد من وجود مجلد الرفع عند البدء
function ensureDir() {
  if (!fs.existsSync(cfg.storage.localDir))
    fs.mkdirSync(cfg.storage.localDir, { recursive: true });
}

function getPublicUrl(filename) {
  return '/api/files/' + filename;
}

function getFilePath(filename) {
  return path.join(cfg.storage.localDir, path.basename(filename));
}

function deleteFile(filename) {
  try {
    const p = getFilePath(filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

module.exports = { ensureDir, getPublicUrl, getFilePath, deleteFile };
