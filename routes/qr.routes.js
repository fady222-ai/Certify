// routes/qr.routes.js
'use strict';

const router  = require('express').Router();
const path    = require('path');
const upload  = require('../middleware/upload.middleware');
const qrSvc   = require('../services/qr.service');

// إنشاء جلسة QR
router.post('/qr/create', async (req, res, next) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl  = `${protocol}://${req.get('host')}`;
    const result   = await qrSvc.createSession({ ...req.body, baseUrl });
    res.json(result);
  } catch (e) { next(e); }
});

// جلب بيانات الجلسة (من الهاتف)
router.get('/qr/session/:token', (req, res) => {
  const s = qrSvc.getSession(req.params.token);
  if (!s) return res.status(410).json({ error: 'انتهت الصلاحية', expired: true });
  res.json({ from_name: s.from_name, to_name: s.to_name, expires_at: s.expires_at });
});

// رفع ملف من الهاتف
router.post('/qr/upload', upload.single('file'), (req, res, next) => {
  try {
    const msg = qrSvc.handleMobileUpload({ file: req.file, token: req.body.token, caption: req.body.caption });
    // إشعار المستقبِل والمُرسِل عبر Socket
    const io  = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    [msg.from_id, msg.to_id].forEach(uid => {
      const sockets = onlineUsers?.get(uid);
      if (sockets) sockets.forEach(sid => io.to(sid).emit('new_message', msg));
    });
    res.json({ ok: true, msg });
  } catch (e) { next(e); }
});

module.exports = router;
