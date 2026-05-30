// middleware/error.middleware.js — معالجة الأخطاء الموحدة
'use strict';

const multer = require('multer');

function errorHandler(err, req, res, next) {
  // أخطاء Multer
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'حجم الملف يتجاوز الحد المسموح' : err.message;
    return res.status(400).json({ error: msg });
  }

  // أخطاء التحقق
  if (err.type === 'validation') {
    return res.status(400).json({ error: err.message });
  }

  // أخطاء غير مصرح
  if (err.type === 'unauthorized') {
    return res.status(401).json({ error: err.message || 'غير مصرح' });
  }

  // أخطاء عامة
  console.error('[error]', err.message || err);
  res.status(500).json({ error: 'حدث خطأ في السيرفر' });
}

// خطأ تحقق سريع
function validationError(msg) {
  const e = new Error(msg);
  e.type  = 'validation';
  return e;
}

function unauthorizedError(msg) {
  const e = new Error(msg);
  e.type  = 'unauthorized';
  return e;
}

module.exports = { errorHandler, validationError, unauthorizedError };
