// middleware/rate-limit.middleware.js
'use strict';

const rateLimit = require('express-rate-limit');

const handler = (req, res) =>
  res.status(429).json({ error: 'محاولات كثيرة. أعد المحاولة بعد قليل.', retry: true });

const login = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

const backupPrepare = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

const backupRestore = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

const general = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

module.exports = { login, backupPrepare, backupRestore, general };
