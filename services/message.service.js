// services/message.service.js
'use strict';

const db = require('../repositories/db.repository');
const { validationError } = require('../middleware/error.middleware');

function sendMessage({ from_id, to_id, text, msg_type='text', file_url, file_name, file_size, duration }) {
  if (!from_id || !to_id) throw validationError('from_id و to_id مطلوبان');
  if (msg_type === 'text' && !text?.trim()) throw validationError('النص مطلوب');

  const msg      = db.messages.save({ from_id, to_id, text: text?.trim() || '', msg_type, file_url, file_name, file_size, duration });
  const fromUser = db.users.findById(from_id);
  return { ...msg, from_name: fromUser?.name, from_type: fromUser?.type };
}

function getConversation(uid1, uid2) {
  if (!uid1 || !uid2) throw validationError('userId1 و userId2 مطلوبان');
  return db.messages.getConversation(Number(uid1), Number(uid2));
}

function markRead(fromId, toId) {
  db.messages.markRead(Number(fromId), Number(toId));
}

function getUnreadCounts(userId) {
  return db.messages.getUnreadCounts(Number(userId));
}

function searchMessages(uid1, uid2, query) {
  if (!query?.trim()) throw validationError('query مطلوب');
  return db.messages.search(Number(uid1), Number(uid2), query.trim());
}

function editMessage(msgId, newText, requesterId) {
  if (!newText?.trim()) throw validationError('النص لا يمكن أن يكون فارغاً');

  const msg = db.messages.findById(Number(msgId));
  if (!msg)                           throw validationError('الرسالة غير موجودة');
  if (msg.from_id !== Number(requesterId)) throw validationError('لا يمكنك تعديل رسالة شخص آخر');
  if (msg.is_deleted)                  throw validationError('الرسالة محذوفة');
  if (msg.msg_type !== 'text')         throw validationError('لا يمكن تعديل الملفات والصور');

  return db.messages.edit(Number(msgId), newText.trim());
}

function deleteMessage(msgId, requesterId) {
  const msg = db.messages.findById(Number(msgId));
  if (!msg)                                throw validationError('الرسالة غير موجودة');
  if (msg.from_id !== Number(requesterId)) throw validationError('لا يمكنك حذف رسالة شخص آخر');
  if (msg.is_deleted)                      throw validationError('الرسالة محذوفة مسبقاً');

  return db.messages.delete(Number(msgId));
}

module.exports = {
  sendMessage, getConversation, markRead, getUnreadCounts,
  searchMessages, editMessage, deleteMessage,
};
