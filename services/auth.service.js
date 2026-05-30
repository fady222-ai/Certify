// services/auth.service.js
'use strict';

const bcrypt = require('bcryptjs');
const db     = require('../repositories/db.repository');
const cfg    = require('../config');
const { validationError, unauthorizedError } = require('../middleware/error.middleware');

async function login(name, password) {
  if (!name || !password) throw validationError('الاسم وكلمة المرور مطلوبان');

  const user = db.users.findByName(name.trim());
  if (!user) throw unauthorizedError('اسم المستخدم غير موجود');
  if (user.is_active === 0) throw unauthorizedError('هذا الحساب معطّل');
  if (!bcrypt.compareSync(password, user.password)) throw unauthorizedError('كلمة المرور غير صحيحة');

  db.users.updateLastSeen(user.id);
  return { id: user.id, name: user.name, type: user.type };
}

async function adminLogin(password) {
  if (!password) throw validationError('كلمة المرور مطلوبة');
  const admin = db.admin.getPassword();
  if (!admin || !bcrypt.compareSync(password, admin.password))
    throw unauthorizedError('كلمة المرور غير صحيحة');
}

function checkPasswordStrength(pwd) {
  if (!pwd || pwd.length < 12)
    throw validationError('كلمة المرور 12 حرفاً على الأقل');
  if (!/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd) || !/[^A-Za-z0-9]/.test(pwd))
    throw validationError('يجب أن تحوي كلمة المرور حرفاً كبيراً، صغيراً، رقماً، ورمزاً خاصاً');
}

async function changeAdminPassword(newPassword) {
  checkPasswordStrength(newPassword);
  const rounds = Math.max(12, cfg.security.bcryptRounds || 0);
  const hash = bcrypt.hashSync(newPassword, rounds);
  db.admin.updatePassword(hash);
}

module.exports = { login, adminLogin, changeAdminPassword, checkPasswordStrength };
