// routes/files.routes.js
'use strict';

const router     = require('express').Router();
const path       = require('path');
const upload     = require('../middleware/upload.middleware');
const fileSvc    = require('../services/file.service');
const requirePro = require('../middleware/pro-feature.middleware');

// helper: إبلاغ المُستقبِل عبر socket
function notifyRecipient(req, msg) {
  const io      = req.app.get('io');
  const online  = req.app.get('onlineUsers');
  const sockets = online?.get(Number(msg.to_id));
  if (sockets) sockets.forEach(sid => io.to(sid).emit('new_message', msg));
}

// رفع ملف
router.post('/upload', upload.single('file'), (req, res, next) => {
  try {
    const msg = fileSvc.handleUpload({ file: req.file, ...req.body });
    notifyRecipient(req, msg);
    res.json({ ok: true, msg });
  } catch (e) { next(e); }
});

// رفع رسالة صوتية (Pro فقط)
router.post('/upload/voice', requirePro('الرسائل الصوتية'), upload.single('voice'), (req, res, next) => {
  try {
    const msg = fileSvc.handleVoiceUpload({ file: req.file, ...req.body });
    notifyRecipient(req, msg);
    res.json({ ok: true, msg });
  } catch (e) { next(e); }
});

// تحميل ملف
router.get('/files/:filename', (req, res) => {
  const filePath = fileSvc.getFilePath(req.params.filename);
  res.sendFile(filePath, err => {
    if (err) res.status(404).json({ error: 'الملف غير موجود' });
  });
});

module.exports = router;
