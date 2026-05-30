// routes/messages.routes.js
'use strict';

const router  = require('express').Router();
const msgSvc  = require('../services/message.service');

router.get('/:uid1/:uid2',    (req, res, next) => {
  try { res.json(msgSvc.getConversation(req.params.uid1, req.params.uid2)); }
  catch (e) { next(e); }
});

router.get('/search',         (req, res, next) => {
  try {
    const { userId1, userId2, query } = req.query;
    res.json(msgSvc.searchMessages(userId1, userId2, query));
  } catch (e) { next(e); }
});

router.post('/read',          (req, res, next) => {
  try {
    const { fromId, toId } = req.body;
    msgSvc.markRead(fromId, toId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/unread/:userId', (req, res, next) => {
  try { res.json(msgSvc.getUnreadCounts(req.params.userId)); }
  catch (e) { next(e); }
});

// إرسال رسالة عبر REST (fallback عند انقطاع Socket)
router.post('/send', (req, res, next) => {
  try {
    const { from_id, to_id, text } = req.body;
    const msg = msgSvc.sendMessage({ from_id: Number(from_id), to_id: Number(to_id), text });

    // إبلاغ المستقبِل عبر Socket إن كان متصلاً
    const io          = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    const sockets     = onlineUsers?.get(Number(to_id));
    if (sockets) sockets.forEach(sid => io.to(sid).emit('new_message', msg));

    res.json({ ok: true, ...msg });
  } catch (e) { next(e); }
});

// تعديل رسالة
router.put('/:msgId', (req, res, next) => {
  try {
    const { text, requesterId } = req.body;
    const msg = msgSvc.editMessage(req.params.msgId, text, requesterId);
    // إبلاغ الطرف الآخر بالتعديل
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    const peerId = msg.from_id; // المستقبِل الأصلي
    // نُبلغ كلا الطرفين
    [msg.from_id, msg.to_id].forEach(uid => {
      const sockets = onlineUsers?.get(uid);
      if (sockets) sockets.forEach(sid => io.to(sid).emit('message_edited', { msgId: msg.id, text: msg.text, edited_at: msg.edited_at }));
    });
    res.json({ ok: true, msg });
  } catch (e) { next(e); }
});

// حذف رسالة
router.delete('/:msgId', (req, res, next) => {
  try {
    const { requesterId } = req.body;
    const msg = msgSvc.deleteMessage(req.params.msgId, requesterId);
    // إبلاغ الطرف الآخر بالحذف
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    [msg.from_id, msg.to_id].forEach(uid => {
      const sockets = onlineUsers?.get(uid);
      if (sockets) sockets.forEach(sid => io.to(sid).emit('message_deleted', { msgId: msg.id }));
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
