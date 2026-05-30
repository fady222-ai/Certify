// routes/keys.routes.js
'use strict';

const router  = require('express').Router();
const userSvc = require('../services/user.service');
const { validationError } = require('../middleware/error.middleware');

router.post('/upload', (req, res, next) => {
  try {
    const { userId, publicKey } = req.body;
    if (!userId || !publicKey) throw validationError('userId و publicKey مطلوبان');
    userSvc.savePublicKey(userId, publicKey);
    // إبلاغ الكل بالمفتاح الجديد (يتم من socket handler)
    req.app.get('io')?.emit('public_key_updated', { userId: Number(userId), publicKey });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/', (req, res, next) => {
  try { res.json(userSvc.getAllPublicKeys()); }
  catch (e) { next(e); }
});

router.get('/:userId', (req, res, next) => {
  try {
    const key = userSvc.getPublicKey(req.params.userId);
    if (!key) return res.status(404).json({ error: 'لا يوجد مفتاح' });
    res.json({ userId: Number(req.params.userId), publicKey: key });
  } catch (e) { next(e); }
});

module.exports = router;
