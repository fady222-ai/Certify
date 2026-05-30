// socket/socket.handler.js — Socket.IO منفصل تماماً
'use strict';

const msgSvc = require('../services/message.service');
const db     = require('../repositories/db.repository');

// مرجع ضعيف لـ io ولـ onlineUsers — يُملآن من initSocket
let _io = null;
let _onlineUsers = null;

function initSocket(io) {
  _io = io;
  const onlineUsers = new Map();
  _onlineUsers = onlineUsers;

  io.engine.on('initial_headers', () => {});

  function notifyUser(userId, event, data) {
    const sockets = onlineUsers.get(userId);
    if (sockets) sockets.forEach(sid => io.to(sid).emit(event, data));
  }

  function broadcastStatus(userId, online) {
    io.emit('user_status', { userId, online });
  }

  io.on('connection', socket => {
    let currentUserId = null;

    socket.on('register', userId => {
      const uid = Number(userId);
      const u = db.users.findById(uid);
      // طرد الحسابات المعطَّلة أو غير الموجودة
      if (!u) {
        socket.emit('force_logout', { reason: 'unknown_user' });
        return socket.disconnect(true);
      }
      if (u.is_active !== 1) {
        socket.emit('force_logout', { reason: 'account_disabled' });
        return socket.disconnect(true);
      }
      currentUserId = uid;
      if (!onlineUsers.has(currentUserId)) onlineUsers.set(currentUserId, new Set());
      onlineUsers.get(currentUserId).add(socket.id);
      broadcastStatus(currentUserId, true);
    });

    socket.on('send_message', ({ from_id, to_id, text }, ack) => {
      try {
        const msg = msgSvc.sendMessage({ from_id: Number(from_id), to_id: Number(to_id), text });
        notifyUser(Number(to_id), 'new_message', msg);
        if (typeof ack === 'function') ack({ ok: true, msg });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: e.message });
      }
    });

    socket.on('typing', ({ from_id, to_id, isTyping }) => {
      notifyUser(Number(to_id), 'typing', { from_id, isTyping });
    });

    socket.on('mark_read', ({ fromId, toId }) => {
      msgSvc.markRead(fromId, toId);
      notifyUser(Number(fromId), 'messages_read', { by: Number(toId) });
    });

    socket.on('disconnect', () => {
      if (!currentUserId) return;
      const sockets = onlineUsers.get(currentUserId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(currentUserId);
          broadcastStatus(currentUserId, false);
        }
      }
    });
  });

  return onlineUsers;
}

// طرد فوري لكل جلسات مستخدم (للاستخدام من خارج الـ socket — مثلاً heartbeat)
function forceLogout(userId, reason) {
  if (!_io || !_onlineUsers) return false;
  const uid = Number(userId);
  const sockets = _onlineUsers.get(uid);
  if (!sockets) return false;
  for (const sid of sockets) {
    const s = _io.sockets.sockets.get(sid);
    if (s) {
      try { s.emit('force_logout', { reason }); } catch {}
      try { s.disconnect(true); } catch {}
    }
  }
  _onlineUsers.delete(uid);
  _io.emit('user_status', { userId: uid, online: false });
  return true;
}

module.exports = { initSocket, forceLogout };
