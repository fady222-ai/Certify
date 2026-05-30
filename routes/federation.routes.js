// routes/federation.routes.js
// مسارات التواصل بين السيرفرات (server-to-server)
// mounted على /api/federation  — تُستدعى من سيرفرات الكيانات الأخرى
'use strict';

const router = require('express').Router();
const db     = require('../repositories/db.repository');
const fed    = require('../services/federation.service');
const licSvc = require('../services/license.service');

// ── middleware: السيرفر المستقبِل يجب أن يكون Pro أيضاً ───
router.use((req, res, next) => {
  fed.rememberServerUrlFromRequest(req);
  try { fed.requirePro(); next(); }
  catch (e) {
    res.status(403).json({ error: 'الكيان المستقبِل لا يشترك في الباقة الاحترافية', reason: 'pro_required' });
  }
});

// ── helper: إبلاغ مستخدم محلي عبر sockets ────────────────
function emitToUser(req, userId, event, data) {
  const io      = req.app.get('io');
  const online  = req.app.get('onlineUsers');
  const sockets = online?.get(Number(userId));
  if (sockets) sockets.forEach(sid => io.to(sid).emit(event, data));
}

// ── التحقق من كود مستخدم (lookup) ────────────────────────
router.post('/lookup', (req, res) => {
  try {
    const decoded = fed.decodeContactCode(req.body?.code);
    if (!decoded) return res.status(400).json({ error: 'كود غير صحيح' });
    const user = db.users.findById(decoded.user_id);
    if (!user)  return res.status(404).json({ error: 'الحساب غير موجود' });
    const status = licSvc.getServerStatus();
    res.json({
      ok: true,
      user_name: user.name,
      user_type: user.type, // 'branch' | 'store'
      entity:    status.entity_name || '',
    });
  } catch { res.status(400).json({ error: 'خطأ' }); }
});

// ── استقبال طلب تواصل من سيرفر آخر ───────────────────────
router.post('/request', (req, res) => {
  try {
    const { from_code, from_name, from_entity, from_server, to_code } = req.body;
    const decoded = fed.decodeContactCode(to_code);
    if (!decoded) return res.status(400).json({ error: 'كود المستقبِل غير صحيح' });

    const localUser = db.users.findById(decoded.user_id);
    if (!localUser) return res.status(404).json({ error: 'المستخدم غير موجود' });

    db.externalContacts.createRequest({
      direction:      'incoming',
      local_user_id:  localUser.id,
      remote_name:    `${from_entity} — ${from_name}`,
      remote_user_id: fed.decodeContactCode(from_code)?.user_id || 0,
      remote_server:  from_server,
      remote_code:    from_code,
    });

    emitToUser(req, localUser.id, 'new_contact_request', {
      from_name: `${from_entity} — ${from_name}`,
    });

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── استقبال قبول طلب من سيرفر آخر ────────────────────────
router.post('/accepted', (req, res) => {
  try {
    const { from_code, from_name, from_entity, from_server, to_code } = req.body;
    const decoded = fed.decodeContactCode(to_code);
    if (!decoded) return res.status(400).json({ error: 'كود غير صحيح' });

    const localUser = db.users.findById(decoded.user_id);
    if (!localUser) return res.status(404).json({ error: 'المستخدم غير موجود' });

    const fromDecoded = fed.decodeContactCode(from_code);
    const remoteName  = `${from_entity} — ${from_name}`;

    const outgoing = db.externalContacts.findRequestByRemoteCode(from_code, 'outgoing');
    if (outgoing) db.externalContacts.updateRequest(outgoing.id, 'accepted');

    db.externalContacts.addContact({
      local_user_id:  localUser.id,
      remote_name:    remoteName,
      remote_user_id: fromDecoded?.user_id || 0,
      remote_server:  from_server || outgoing?.remote_server || '',
      remote_code:    from_code,
    });

    emitToUser(req, localUser.id, 'contact_request_accepted', {
      remote_name: remoteName,
      remote_code: from_code,
    });

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── استقبال رسالة من سيرفر آخر ───────────────────────────
router.post('/message', (req, res) => {
  try {
    const { from_code, to_code, text } = req.body;
    const decoded = fed.decodeContactCode(to_code);
    if (!decoded) return res.status(400).json({ error: 'كود غير صحيح' });

    const localUser = db.users.findById(decoded.user_id);
    if (!localUser) return res.status(404).json({ error: 'المستخدم غير موجود' });

    // التحقق من وجود علاقة اتصال
    const contact = db.externalContacts.findByRemoteCode(from_code);
    if (!contact) return res.status(403).json({ error: 'غير مصرح — لستم على اتصال' });

    const msg = db.externalContacts.saveExtMsg({
      local_user_id: localUser.id,
      remote_code:   from_code,
      remote_name:   contact.remote_name,
      from_remote:   true,
      text:          text || '',
    });

    emitToUser(req, localUser.id, 'ext_new_message', {
      ...msg, remote_name: contact.remote_name,
    });

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
