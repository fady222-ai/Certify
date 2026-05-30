// routes/users.routes.js
'use strict';

const router  = require('express').Router();
const userSvc = require('../services/user.service');

router.get('/', (req, res, next) => {
  try {
    const onlineMap = req.app.get('onlineUsers');
    res.json(userSvc.getAllUsers(onlineMap));
  } catch (e) { next(e); }
});

module.exports = router;
