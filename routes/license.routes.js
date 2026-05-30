// server/routes/license.routes.js
// سيرفر الكيان — routes التفعيل فقط (بدون routes المطور)
'use strict';

const router = require('express').Router();
const licSvc = require('../services/license.service');
const fedSvc = require('../services/federation.service');

// ── تفعيل السيرفر (من داشبورد الأدمن مرة واحدة) ─────────
router.post('/api/server/activate', async (req, res, next) => {
  try {
    const { key, central_url } = req.body;
    if (!key?.trim())
      return res.status(400).json({ error: 'كود التفعيل مطلوب' });

    // إذا أرسل الأدمن رابط المركزي، نضعه في process.env مؤقتاً
    if (central_url) process.env.CENTRAL_SERVER_URL = central_url;

    // تمرير رابط هذا السيرفر للمركزي ليُسجَّل في الدليل
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host  = req.get('host');
    const myUrl = host ? `${proto}://${host}` : '';

    const result = await licSvc.activateServer(key, myUrl);
    res.json({ ok: true, server: result });
  } catch (e) { next(e); }
});

// ── حالة تفعيل هذا السيرفر (يُستدعى من العميل عند كل تشغيل) ──
router.get('/api/server/status', (req, res) => {
  res.json(licSvc.getServerStatus());
});

// ── الباقات المتاحة ───────────────────────────────────────
router.get('/api/license/plans', (_, res) => {
  res.json(licSvc.getAllPlans());
});

// ── تشخيص حالة الـ federation (للأدمن) ───────────────────
router.get('/api/server/diagnostics', async (req, res, next) => {
  try {
    fedSvc.rememberServerUrlFromRequest(req);
    const diag = await licSvc.getDiagnostics(() => fedSvc.getOwnServerUrl());
    res.json(diag);
  } catch (e) { next(e); }
});

// ── إعادة المزامنة الفورية مع المركزي ────────────────────
router.post('/api/server/resync', async (req, res, next) => {
  try {
    fedSvc.rememberServerUrlFromRequest(req);
    const result = await licSvc.runHeartbeat(() => fedSvc.getOwnServerUrl());
    if (!result.ok) return res.status(400).json({ ok: false, error: result.message || result.reason });
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
