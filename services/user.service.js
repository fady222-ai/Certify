// services/user.service.js
'use strict';

const bcrypt = require('bcryptjs');
const db     = require('../repositories/db.repository');
const cfg    = require('../config');
const licSvc = require('./license.service');
const { validationError } = require('../middleware/error.middleware');

function getAllUsers(onlineMap) {
  const users = db.users.findAll();
  return users.map(u => ({
    ...u,
    online: onlineMap ? (onlineMap.has(u.id) && onlineMap.get(u.id).size > 0) : false,
  }));
}

function createUser({ name, type, password }) {
  if (!name?.trim()) throw validationError('الاسم مطلوب');
  if (!['branch','store'].includes(type)) throw validationError('النوع يجب أن يكون branch أو store');
  if (!password)      throw validationError('كلمة المرور مطلوبة');

  if (type === 'branch') licSvc.checkBranchLimit();

  const passwordHash = bcrypt.hashSync(password, cfg.security.bcryptRounds);
  try {
    return db.users.create({ name: name.trim(), type, passwordHash });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) throw validationError('الاسم موجود مسبقاً');
    throw e;
  }
}

function updateUser(id, { name, password, is_active }) {
  if (name     !== undefined) db.users.updateName(id, name.trim());
  if (password !== undefined && password !== '') {
    const hash = bcrypt.hashSync(password, cfg.security.bcryptRounds);
    db.users.updatePassword(id, hash);
  }
  if (is_active !== undefined) db.users.updateActive(id, is_active ? 1 : 0);
}

function deleteUser(id) {
  db.users.delete(Number(id));
}

function savePublicKey(userId, publicKey) {
  db.users.updatePublicKey(Number(userId), publicKey);
}

function getAllPublicKeys() {
  return db.users.allPublicKeys();
}

function getPublicKey(userId) {
  const u = db.users.findById(Number(userId));
  return u?.public_key || null;
}

function getAdminUserList(onlineMap) {
  const users = db.users.findAll();
  return users.map(u => ({
    ...u,
    online:   onlineMap ? (onlineMap.has(u.id) && onlineMap.get(u.id).size > 0) : false,
    activity: db.stats.userActivity(u.id),
  }));
}

module.exports = {
  getAllUsers, createUser, updateUser, deleteUser,
  savePublicKey, getAllPublicKeys, getPublicKey, getAdminUserList,
};
