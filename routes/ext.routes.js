// routes/ext.routes.js
// مسارات التواصل الخارجي — للعميل المحلي (تطبيق الفرع)
// mounted على /api/ext  — جميعها تتطلب باقة Pro
'use strict';

const router = require('express').Router();
const db     = require('../repositories/db.repository');
const fed    = require('../services/federation.service');

// ── middleware: كل المسارات تتطلب Pro ────────────────────
router.use((req, res, next) => {
  try { fed.requirePro(); next(); }
  catch (e) { res.status(403).json({ error: e.message, reason: 'pro_required' }); }
});

// ── helper: إبلاغ المستخدم عبر sockets ───────────────────
function emitToUser(req, userId, event, data) {
  const io      = req.app.get('io');
  const online  = req.app.get('onlineUsers');
  const sockets = online?.get(Number(userId));
  if (sockets) sockets.forEach(sid => io.to(sid).emit(event, data));
}

// ── كود الاتصال الخاص بالمستخدم ──────────────────────────
router.get('/contact-code/:userId', (req, res, next) => {
  try {
    // الكود يعتمد على رابط السيرفر — نمرّر req للاكتشاف التلقائي
    fed.rememberServerUrlFromRequest(req);
    const code = fed.generateContactCode(Number(req.params.userId));
    const user = db.users.findById(Number(req.params.userId));
    res.json({ ok: true, code, user_name: user?.name });
  } catch (e) { next(e); }
});

// ── البحث عن جهة بكودها (preview قبل إرسال الطلب) ───────
router.post('/lookup', async (req, res, next) => {
  try {
    fed.rememberServerUrlFromRequest(req);
    if (!req.body?.code) return res.status(400).json({ error: 'الكود مطلوب' });
    res.json(await fed.lookupContact(req.body.code));
  } catch (e) { next(e); }
});

// ── إرسال طلب تواصل ──────────────────────────────────────
router.post('/request', async (req, res, next) => {
  try {
    fed.rememberServerUrlFromRequest(req);
    const { localUserId, targetCode } = req.body;
    res.json(await fed.sendContactRequest(Number(localUserId), targetCode));
  } catch (e) { next(e); }
});

// ── قبول طلب ─────────────────────────────────────────────
router.post('/accept/:requestId', async (req, res, next) => {
  try {
    fed.rememberServerUrlFromRequest(req);
    const localUserId = Number(req.body.localUserId);
    const result = await fed.acceptRequest(localUserId, Number(req.params.requestId));
    emitToUser(req, localUserId, 'contact_accepted', { requestId: req.params.requestId });
    res.json(result);
  } catch (e) { next(e); }
});

// ── رفض طلب ──────────────────────────────────────────────
router.post('/reject/:requestId', (req, res, next) => {
  try {
    res.json(fed.rejectRequest(Number(req.body.localUserId), Number(req.params.requestId)));
  } catch (e) { next(e); }
});

// ── جهات الاتصال الخارجية ────────────────────────────────
router.get('/contacts/:userId', (req, res, next) => {
  try { res.json(db.externalContacts.findByLocalUser(Number(req.params.userId))); }
  catch (e) { next(e); }
});

// ── الطلبات الواردة ──────────────────────────────────────
router.get('/requests/incoming/:userId', (req, res, next) => {
  try { res.json(db.externalContacts.getPendingIncoming(Number(req.params.userId))); }
  catch (e) { next(e); }
});

// ── محادثة خارجية ────────────────────────────────────────
router.get('/messages/:userId/:remoteCode', (req, res, next) => {
  try {
    res.json(db.externalContacts.getExtConversation(
      Number(req.params.userId),
      decodeURIComponent(req.params.remoteCode),
    ));
  } catch (e) { next(e); }
});

// ── إرسال رسالة خارجية ───────────────────────────────────
router.post('/messages/send', async (req, res, next) => {
  try {
    fed.rememberServerUrlFromRequest(req);
    const { localUserId, remoteCode, text } = req.body;
    const msg = await fed.sendExternalMessage({ localUserId: Number(localUserId), remoteCode, text });
    emitToUser(req, localUserId, 'ext_message_sent', msg);
    res.json({ ok: true, msg });
  } catch (e) { next(e); }
});

// ── تحديد كمقروء ─────────────────────────────────────────
router.post('/messages/read', (req, res, next) => {
  try {
    db.externalContacts.markExtRead(Number(req.body.userId), req.body.remoteCode);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── عدد غير المقروء ──────────────────────────────────────
router.get('/unread/:userId', (req, res, next) => {
  try { res.json(db.externalContacts.getUnreadExtCounts(Number(req.params.userId))); }
  catch (e) { next(e); }
});

module.exports = router;
