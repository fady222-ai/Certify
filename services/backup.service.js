// services/backup.service.js
// نسخة احتياطية متّسقة (online backup) مع تشفير AES-256-GCM
'use strict';

const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const cfg      = require('../config');
const { validationError } = require('../middleware/error.middleware');

// مشتق المفتاح من passphrase باستخدام scrypt
function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 });
}

// نسخة متّسقة عبر better-sqlite3 backup API ثم تشفير المخرج
// يعيد: { fileName, encryptedPath, meta: { iv, tag, salt } }
async function makeEncryptedBackup(passphrase) {
  if (!passphrase || passphrase.length < 8)
    throw validationError('كلمة مرور التشفير 8 أحرف على الأقل');

  const Database = require('better-sqlite3');
  const tmpDir   = path.join(path.dirname(cfg.db.path), '.backup-tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const stamp        = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = path.join(tmpDir, `snapshot-${stamp}.db`);
  const encryptedPath = path.join(tmpDir, `snapshot-${stamp}.db.enc`);

  // 1) نسخة متّسقة (online backup)
  const src = new Database(cfg.db.path, { readonly: true });
  await src.backup(snapshotPath);
  src.close();

  // 2) تشفير AES-256-GCM
  const salt   = crypto.randomBytes(16);
  const iv     = crypto.randomBytes(12);
  const key    = deriveKey(passphrase, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const input  = fs.createReadStream(snapshotPath);
  const output = fs.createWriteStream(encryptedPath);

  await new Promise((resolve, reject) => {
    input.pipe(cipher).pipe(output).on('finish', resolve).on('error', reject);
  });

  const tag = cipher.getAuthTag();

  // 3) حذف الـ snapshot الخام فوراً
  try { fs.unlinkSync(snapshotPath); } catch {}

  return {
    encryptedPath,
    fileName: `backup-${new Date().toISOString().slice(0,10)}.bcbackup`,
    meta: {
      v:    1,
      alg:  'aes-256-gcm',
      iv:   iv.toString('base64'),
      tag:  tag.toString('base64'),
      salt: salt.toString('base64'),
    },
  };
}

// التحقق من صحة ملف backup (header + meta)
function parseBackupMeta(metaHeader) {
  try {
    const m = JSON.parse(Buffer.from(metaHeader, 'base64').toString('utf8'));
    if (m.v !== 1 || m.alg !== 'aes-256-gcm' || !m.iv || !m.tag || !m.salt) return null;
    return m;
  } catch { return null; }
}

function encodeMetaForHeader(meta) {
  return Buffer.from(JSON.stringify(meta)).toString('base64');
}

// استعادة من ملف مشفَّر (تيار) + passphrase + meta
async function restoreFromEncrypted(encryptedFilePath, passphrase, meta) {
  if (!passphrase) throw validationError('كلمة مرور التشفير مطلوبة');
  const m = (typeof meta === 'string') ? parseBackupMeta(meta) : meta;
  if (!m) throw validationError('بيانات التشفير غير صحيحة');

  const tmpDir = path.join(path.dirname(cfg.db.path), '.backup-tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const restoredPath = path.join(tmpDir, `restored-${Date.now()}.db`);

  const key      = deriveKey(passphrase, Buffer.from(m.salt, 'base64'));
  const iv       = Buffer.from(m.iv,  'base64');
  const tag      = Buffer.from(m.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const input  = fs.createReadStream(encryptedFilePath);
  const output = fs.createWriteStream(restoredPath);

  try {
    await new Promise((resolve, reject) => {
      input.pipe(decipher).pipe(output).on('finish', resolve).on('error', reject);
    });
  } catch (e) {
    try { fs.unlinkSync(restoredPath); } catch {}
    throw validationError('فشل فك التشفير — تحقق من كلمة المرور أو سلامة الملف');
  }

  // تحقق أن المخرج SQLite صالح
  try {
    const Database = require('better-sqlite3');
    const test = new Database(restoredPath, { readonly: true });
    test.prepare('SELECT COUNT(*) as c FROM users').get();
    test.close();
  } catch {
    try { fs.unlinkSync(restoredPath); } catch {}
    throw validationError('الملف المُستعاد ليس قاعدة بيانات صالحة');
  }

  return restoredPath;
}

// استبدال DB حالي بـ DB مستعاد (يجب أن يتم بحذر)
function swapDatabase(restoredPath) {
  const dbPath  = cfg.db.path;
  const backupOld = dbPath + '.before-restore';
  try { if (fs.existsSync(backupOld)) fs.unlinkSync(backupOld); } catch {}
  fs.renameSync(dbPath, backupOld);
  fs.renameSync(restoredPath, dbPath);
  return { previousBackup: backupOld };
}

module.exports = {
  makeEncryptedBackup,
  restoreFromEncrypted,
  swapDatabase,
  parseBackupMeta,
  encodeMetaForHeader,
};
