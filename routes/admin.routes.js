// routes/admin.routes.js
'use strict';

const router   = require('express').Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { adminAuth, createBackupTicket, consumeBackupTicket, revokeSession } = require('../middleware/auth.middleware');
const rl       = require('../middleware/rate-limit.middleware');
const authSvc  = require('../services/auth.service');
const userSvc  = require('../services/user.service');
const audit    = require('../services/audit.service');
const backupSvc = require('../services/backup.service');
const licSvc   = require('../services/license.service');
const { forceLogout } = require('../socket/socket.handler');
const db       = require('../repositories/db.repository');
const cfg      = require('../config');

// صفحة الداشبورد
router.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin.html')));

// ── Endpoints محمية بـ ticket فقط (قبل adminAuth) ────────
// تنزيل النسخة الاحتياطية باستخدام ticket لمرة واحدة
router.get('/backup/download', (req, res) => {
  const ticket  = req.query.ticket;
  const payload = consumeBackupTicket(req, ticket, 'backup_download');
  if (!payload || !payload.filePath) {
    audit.log('backup_download', req, false, { reason: 'invalid_ticket' });
    return res.status(401).json({ error: 'ticket غير صالح أو منتهٍ' });
  }
  audit.log('backup_download', req, true, { fileName: payload.fileName });

  // metadata في headers قبل بدء البث
  res.setHeader('X-Backup-Meta', backupSvc.encodeMetaForHeader(payload.meta));
  res.setHeader('Access-Control-Expose-Headers', 'X-Backup-Meta');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);

  const stream = fs.createReadStream(payload.filePath);
  stream.pipe(res);
  stream.on('close', () => { try { fs.unlinkSync(payload.filePath); } catch {} });
});

// تنفيذ الاستعادة باستخدام ticket + ملف مشفَّر
const upload = multer({ dest: path.join(path.dirname(cfg.db.path), '.backup-tmp'), limits: { fileSize: 500 * 1024 * 1024 } });
router.post('/backup/restore-execute', upload.single('file'), async (req, res, next) => {
  const cleanup = (p) => { try { p && fs.existsSync(p) && fs.unlinkSync(p); } catch {} };
  try {
    const ticket  = req.query.ticket || req.body?.ticket;
    const payload = consumeBackupTicket(req, ticket, 'backup_restore');
    if (!payload) { cleanup(req.file?.path); audit.log('backup_restore', req, false, { reason: 'invalid_ticket' }); return res.status(401).json({ error: 'ticket غير صالح' }); }
    if (!req.file) return res.status(400).json({ error: 'الملف مفقود' });

    const restoredPath = await backupSvc.restoreFromEncrypted(req.file.path, payload.passphrase, payload.meta);
    cleanup(req.file.path);

    const { previousBackup } = backupSvc.swapDatabase(restoredPath);
    audit.log('backup_restore', req, true, { previousBackup: path.basename(previousBackup) });
    res.json({ ok: true, message: 'تمت الاستعادة. يجب إعادة تشغيل السيرفر يدوياً.', previousBackup: path.basename(previousBackup) });
  } catch (e) {
    cleanup(req.file?.path);
    audit.log('backup_restore', req, false, { reason: e.message });
    next(e);
  }
});

// جميع مسارات /api/admin بعد هذا السطر محمية بـ adminAuth
router.use(adminAuth);

// تسجيل خروج (إبطال الجلسة على السيرفر)
router.post('/logout', (req, res) => {
  const token = req.headers['x-admin-token'] || req.query.token;
  revokeSession(token);
  audit.log('logout', req, true);
  res.json({ ok: true });
});

// إحصائيات
router.get('/stats', (req, res, next) => {
  try {
    const s = db.stats.today();
    res.json({ ...s, online: req.app.get('onlineUsers')?.size || 0 });
  } catch (e) { next(e); }
});

// المستخدمون
router.get('/users', (req, res, next) => {
  try { res.json(userSvc.getAdminUserList(req.app.get('onlineUsers'))); }
  catch (e) { next(e); }
});

router.post('/users', (req, res, next) => {
  try {
    const user = userSvc.createUser(req.body);
    req.app.get('io')?.emit('users_updated');
    audit.log('user_create', req, true, { name: user.name, type: user.type });
    res.json({ ok: true, user });
  } catch (e) { next(e); }
});

router.put('/users/:id', (req, res, next) => {
  try {
    userSvc.updateUser(Number(req.params.id), req.body);
    req.app.get('io')?.emit('users_updated');
    audit.log('user_update', req, true, { id: Number(req.params.id) });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/users/:id', (req, res, next) => {
  try {
    userSvc.deleteUser(req.params.id);
    req.app.get('io')?.emit('users_updated');
    audit.log('user_delete', req, true, { id: Number(req.params.id) });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// تغيير كلمة مرور الأدمن
router.post('/change-password', async (req, res, next) => {
  try {
    await authSvc.changeAdminPassword(req.body.newPassword);
    audit.log('password_change', req, true);
    res.json({ ok: true });
  } catch (e) {
    audit.log('password_change', req, false, { reason: e.message });
    next(e);
  }
});

// ── النسخة الاحتياطية: تدفّق ticket-واحد + تشفير ──────────
// خطوة 1: العميل يطلب ticket مع passphrase
router.post('/backup/prepare', rl.backupPrepare, async (req, res, next) => {
  try {
    const { passphrase } = req.body || {};
    if (!passphrase || passphrase.length < 8) {
      audit.log('backup_prepare', req, false, { reason: 'weak_passphrase' });
      return res.status(400).json({ error: 'كلمة مرور التشفير 8 أحرف على الأقل' });
    }
    // إنشاء النسخة المشفَّرة الآن (حتى الـticket يصبح مرتبطاً بملف جاهز)
    const result = await backupSvc.makeEncryptedBackup(passphrase);
    const ticket = createBackupTicket(req, 'backup_download', {
      filePath: result.encryptedPath,
      fileName: result.fileName,
      meta:     result.meta,
    }, 60 * 1000); // ticket صالح 60 ثانية
    audit.log('backup_prepare', req, true, { fileName: result.fileName });
    res.json({ ok: true, ticket, fileName: result.fileName });
  } catch (e) {
    audit.log('backup_prepare', req, false, { reason: e.message });
    next(e);
  }
});

// خطوة 3: استعادة من ملف مشفَّر
router.post('/backup/restore-prepare', rl.backupRestore, (req, res, next) => {
  try {
    const { passphrase, meta } = req.body || {};
    if (!passphrase) return res.status(400).json({ error: 'كلمة المرور مطلوبة' });
    if (!meta)       return res.status(400).json({ error: 'بيانات التشفير مطلوبة' });
    const ticket = createBackupTicket(req, 'backup_restore', { passphrase, meta }, 5 * 60 * 1000);
    res.json({ ok: true, ticket });
  } catch (e) { next(e); }
});

// سجل الأمان
router.get('/audit', (req, res, next) => {
  try { res.json(audit.tail(50)); } catch (e) { next(e); }
});

// تطبيق حد الفروع يدوياً (مفيد بعد Downgrade لإقفال الجلسات النشطة)
router.post('/enforce-plan', (req, res, next) => {
  try {
    const result = licSvc.enforceBranchLimit();
    result.deactivated.forEach(b => { try { forceLogout(b.id, 'plan_downgrade'); } catch {} });
    audit.log('plan_enforce', req, true, result);
    res.json({ ok: true, ...result });
  } catch (e) {
    audit.log('plan_enforce', req, false, { reason: e.message });
    next(e);
  }
});

// معلومات الفروع/المخازن مقابل الحد
router.get('/plan-status', (req, res, next) => {
  try {
    const status = licSvc.getServerStatus();
    const all    = require('../repositories/db.repository').users.findAll();
    const branches      = all.filter(u => u.type === 'branch');
    const activeBranch  = branches.filter(u => u.is_active === 1).length;
    const disabledBranch= branches.filter(u => u.is_active !== 1).length;
    res.json({
      plan:       status.plan,
      plan_label: status.plan_label,
      limit:      status.max_branches || 0,
      active:     activeBranch,
      disabled:   disabledBranch,
      over_limit: activeBranch > (status.max_branches || 0),
    });
  } catch (e) { next(e); }
});

module.exports = router;
