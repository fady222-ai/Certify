// middleware/license.middleware.js
// يتحقق من License في كل طلب يحتاج صلاحيات
'use strict';

const licSvc = require('../services/license.service');

// يتحقق من License ويضيف بيانات الباقة لـ req.license
function requireLicense(req, res, next) {
  const key = req.headers['x-license-key'] || req.body?.licenseKey;
  if (!key) return res.status(403).json({ error: 'License Key مطلوب', reason: 'missing' });

  const result = licSvc.validateLicense(key);
  if (!result.valid) return res.status(403).json({ error: result.message, reason: result.reason });

  req.license = result;
  next();
}

module.exports = { requireLicense };
