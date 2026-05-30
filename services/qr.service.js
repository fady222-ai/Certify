// services/qr.service.js
'use strict';

const QRCode  = require('qrcode');
const { v4: uuid } = require('uuid');
const cfg     = require('../config');
const db      = require('../repositories/db.repository');
const fileSvc = require('./file.service');
const { validationError } = require('../middleware/error.middleware');

// تخزين جلسات QR في الذاكرة
const sessions = new Map();

// تنظيف الجلسات المنتهية
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of sessions) {
    if (new Date(s.expires_at).getTime() < now) sessions.delete(token);
  }
}, 60_000);

async function createSession({ from_id, to_id, baseUrl }) {
  if (!from_id || !to_id) throw validationError('from_id و to_id مطلوبان');

  const fromUser = db.users.findById(Number(from_id));
  const toUser   = db.users.findById(Number(to_id));
  if (!fromUser || !toUser) throw validationError('مستخدم غير موجود');

  const token      = uuid();
  const expires_at = new Date(Date.now() + cfg.security.qrSessionTTL).toISOString();
  const uploadUrl  = `${baseUrl}/mobile?token=${token}`;

  sessions.set(token, { from_id: Number(from_id), to_id: Number(to_id), from_name: fromUser.name, to_name: toUser.name, expires_at });

  const qr = await new Promise((res, rej) =>
    QRCode.toDataURL(uploadUrl, { width:300, margin:2, color:{ dark:'#3a5bef', light:'#0f0f1a' } },
      (err, url) => err ? rej(err) : res(url))
  );

  return { token, qr, expires_at, upload_url: uploadUrl };
}

function getSession(token) {
  const s = sessions.get(token);
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) { sessions.delete(token); return null; }
  return s;
}

function handleMobileUpload({ file, token, caption }) {
  const session = getSession(token);
  if (!session) throw validationError('انتهت صلاحية الجلسة أو الرابط غير صحيح');

  const msg = fileSvc.handleUpload({ file, from_id: session.from_id, to_id: session.to_id, caption });
  sessions.delete(token); // استخدام لمرة واحدة
  return msg;
}

module.exports = { createSession, getSession, handleMobileUpload };
