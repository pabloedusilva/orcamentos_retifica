const express = require('express');
const router = express.Router();
const { login, me, logout } = require('../../controllers/auth.controller');
const { auth } = require('../../middlewares/auth');

router.post('/login', login);
router.get('/me', auth(true), me);
router.post('/logout', auth(false), logout);

module.exports = router;
