// middleware/auth.middleware.js
'use strict';

const crypto = require('crypto');

// تخزين جلسات الأدمن في الذاكرة (multi-instance: انقلها لـ Redis)
// الشكل: token → { uaHash, exp }
const adminSessions = new Map();
// Tickets لمرة واحدة لتنزيل/استعادة النسخة الاحتياطية
// ticket → { token, action, uaHash, exp, payload }
const backupTickets = new Map();

function hashUA(req) {
  const ua = req?.headers?.['user-agent'] || '';
  return crypto.createHash('sha256').update(ua).digest('hex').slice(0, 32);
}

function gc() {
  const now = Date.now();
  for (const [k, v] of adminSessions) if (v.exp && v.exp < now) adminSessions.delete(k);
  for (const [k, v] of backupTickets) if (v.exp < now) backupTickets.delete(k);
}
setInterval(gc, 60 * 1000).unref();

function createSession(req, ttl) {
  const token = 'BC-A-' + crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, { uaHash: hashUA(req), exp: Date.now() + ttl });
  return token;
}

function revokeSession(token) {
  return adminSessions.delete(token);
}

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  const sess  = token && adminSessions.get(token);
  if (!sess) return res.status(401).json({ error: 'غير مصرح — يرجى تسجيل الدخول' });
  if (sess.exp < Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({ error: 'انتهت صلاحية الجلسة' });
  }
  if (sess.uaHash !== hashUA(req)) {
    return res.status(401).json({ error: 'جلسة غير متطابقة — يرجى تسجيل الدخول' });
  }
  next();
}

// إنشاء ticket لمرة واحدة (للتنزيل أو الاستعادة)
function createBackupTicket(req, action, payload = null, ttlMs = 60 * 1000) {
  const ticket = crypto.randomBytes(24).toString('hex');
  const token  = req.headers['x-admin-token'] || req.query.token;
  backupTickets.set(ticket, {
    token,
    action,
    uaHash:  hashUA(req),
    exp:     Date.now() + ttlMs,
    payload, // قد يحوي passphrase لاستخدامها عند الاستهلاك
  });
  return ticket;
}

// استهلاك ticket مرة واحدة — يرجع payload أو null
function consumeBackupTicket(req, ticket, action) {
  const t = backupTickets.get(ticket);
  if (!t) return null;
  backupTickets.delete(ticket); // one-shot
  if (t.action !== action) return null;
  if (t.exp < Date.now()) return null;
  if (t.uaHash !== hashUA(req)) return null;
  if (!adminSessions.has(t.token)) return null; // الجلسة المُصدِرة لم تعد صالحة
  return t.payload || {};
}

module.exports = {
  adminAuth,
  createSession,
  revokeSession,
  createBackupTicket,
  consumeBackupTicket,
  hashUA,
};
