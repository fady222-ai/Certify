// config/index.js — كل الإعدادات من متغيرات البيئة
// لتغيير أي إعداد: غيّر الـ .env فقط بدون لمس الكود
'use strict';
require('dotenv').config();
const path = require('path');

module.exports = {
  // ── السيرفر ──────────────────────────────────────────────
  port: Number(process.env.PORT) || 3000,

  // ── قاعدة البيانات ───────────────────────────────────────
  // PERSISTENT_DIR = المجلد الثابت على Railway (Persistent Volume)
  // لو لم يُحدَّد = نستخدم مجلد السيرفر مباشرة
  db: {
    path: process.env.DB_PATH ||
          path.join(process.env.PERSISTENT_DIR || __dirname, '..', 'data', 'chat.db'),
  },

  // ── الملفات ──────────────────────────────────────────────
  // storage.driver = 'local' | 'cloudinary' (قابل للتوسع)
  storage: {
    driver:   process.env.STORAGE_DRIVER || 'local',
    localDir: process.env.UPLOADS_DIR    ||
              path.join(process.env.PERSISTENT_DIR || __dirname, '..', 'data', 'uploads'),
    maxSize:  Number(process.env.MAX_FILE_MB || 5) * 1024 * 1024,

    // Cloudinary (عند التوسع لاحقاً)
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      apiKey:    process.env.CLOUDINARY_API_KEY    || '',
      apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    },
  },

  // ── الأمان ───────────────────────────────────────────────
  security: {
    adminSessionTTL: Number(process.env.ADMIN_SESSION_TTL || 2) * 60 * 60 * 1000, // 2 ساعة
    qrSessionTTL:    Number(process.env.QR_SESSION_TTL    || 5) * 60 * 1000,       // 5 دقائق
    bcryptRounds:    Number(process.env.BCRYPT_ROUNDS     || 12),
  },

  // ── Socket.IO ────────────────────────────────────────────
  socket: {
    pingInterval: 10000,
    pingTimeout:  5000,
  },

  // ── أنواع الملفات المسموحة ───────────────────────────────
  allowedMimeTypes: [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    // رسائل صوتية
    'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
  ],
};
