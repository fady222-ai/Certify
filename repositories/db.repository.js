// repositories/db.repository.js
// نقطة التواصل الوحيدة مع قاعدة البيانات
// الـ services لا تعرف إذا كانت SQLite أو PostgreSQL
'use strict';

// الـ adapter الحالي — لتبديله: غيّر هذا السطر فقط
const adapter = require('../adapters/sqlite.adapter');

module.exports = {
  init:             () => adapter.init(),
  users:            adapter.users,
  messages:         adapter.messages,
  stats:            adapter.stats,
  admin:            adapter.admin,
  serverLicense:    adapter.serverLicense,
  externalContacts: adapter.externalContacts,
  audit:            adapter.audit,
};
