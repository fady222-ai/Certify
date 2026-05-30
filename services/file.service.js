// services/file.service.js
'use strict';

const storage = require('../adapters/storage/local.storage');
const msgSvc  = require('./message.service');
const { validationError } = require('../middleware/error.middleware');

function handleUpload({ file, from_id, to_id, caption }) {
  if (!file)           throw validationError('لم يتم رفع أي ملف');
  if (!from_id || !to_id) throw validationError('from_id و to_id مطلوبان');

  const isImage  = file.mimetype.startsWith('image/');
  const msg_type = isImage ? 'image' : 'file';
  const file_url  = storage.getPublicUrl(file.filename);
  const file_name = Buffer.from(file.originalname, 'latin1').toString('utf8');
  const file_size = file.size;
  const text      = caption?.trim() || '';

  return msgSvc.sendMessage({ from_id: Number(from_id), to_id: Number(to_id), text, msg_type, file_url, file_name, file_size });
}

function handleVoiceUpload({ file, from_id, to_id, duration }) {
  if (!file) throw validationError('لم يتم رفع التسجيل');
  if (!from_id || !to_id) throw validationError('from_id و to_id مطلوبان');
  if (!file.mimetype.startsWith('audio/')) throw validationError('نوع الملف يجب أن يكون صوتاً');

  const file_url  = storage.getPublicUrl(file.filename);
  const file_size = file.size;
  const dur       = Math.max(1, Math.min(parseInt(duration, 10) || 0, 300)); // 1..300 ثانية

  return msgSvc.sendMessage({
    from_id:   Number(from_id),
    to_id:     Number(to_id),
    text:      '',
    msg_type:  'voice',
    file_url,
    file_name: 'voice.webm',
    file_size,
    duration:  dur,
  });
}

function getFilePath(filename) {
  return storage.getFilePath(filename);
}

module.exports = { handleUpload, handleVoiceUpload, getFilePath };
