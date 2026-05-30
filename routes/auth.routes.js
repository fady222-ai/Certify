// routes/auth.routes.js
'use strict';

const router   = require('express').Router();
const authSvc  = require('../services/auth.service');
const audit    = require('../services/audit.service');
const { createSession } = require('../middleware/auth.middleware');
const rl       = require('../middleware/rate-limit.middleware');
const cfg      = require('../config');

// تسجيل دخول المستخدم
router.post('/login', async (req, res, next) => {
  try {
    const user = await authSvc.login(req.body.name, req.body.password);
    res.json(user);
  } catch (e) { next(e); }
});

// تسجيل دخول الأدمن (مع rate limit صارم)
router.post('/admin/login', rl.login, async (req, res, next) => {
  try {
    await authSvc.adminLogin(req.body.password);
    const token = createSession(req, cfg.security.adminSessionTTL);
    audit.log('login', req, true);
    res.json({ token });
  } catch (e) {
    audit.log('login_fail', req, false, { reason: e.message });
    next(e);
  }
});

module.exports = router;
