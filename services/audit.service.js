// services/audit.service.js
// سجل أمان لأي عملية حسّاسة من داشبورد الأدمن
'use strict';

const db = require('../repositories/db.repository');

function ipOf(req) {
  return (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) || req.socket?.remoteAddress || '';
}

function log(action, req, success = true, meta = null) {
  try {
    db.audit.log({
      action,
      ip:      ipOf(req),
      ua:      req?.headers?.['user-agent'] || '',
      success: success ? 1 : 0,
      meta,
    });
  } catch (e) { console.warn('[audit] log failed:', e.message); }
}

function tail(n = 50) {
  try {
    return db.audit.tail(n).map(r => ({
      ...r,
      meta: r.meta ? safeJson(r.meta) : null,
    }));
  } catch { return []; }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

module.exports = { log, tail, ipOf };
