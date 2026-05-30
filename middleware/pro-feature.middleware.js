// middleware/pro-feature.middleware.js
// gating عام لأي ميزة Pro — يُمرَّر اسم الميزة لإظهاره في رسالة الخطأ
'use strict';

const licSvc = require('../services/license.service');

module.exports = function requirePro(featureName) {
  return (req, res, next) => {
    const status = licSvc.getServerStatus();
    if (!status.activated)
      return res.status(403).json({ error: 'السيرفر غير مفعَّل', reason: 'not_activated' });
    if (status.plan !== 'pro')
      return res.status(403).json({
        error:  `ميزة "${featureName}" متاحة للباقة الاحترافية فقط. يرجى الترقية.`,
        reason: 'pro_required',
      });
    next();
  };
};
