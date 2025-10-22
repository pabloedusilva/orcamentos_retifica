const express = require('express');
const router = express.Router();
const { login, me } = require('../../controllers/auth.controller');
const { auth } = require('../../middlewares/auth');

router.post('/login', login);
router.get('/me', auth(true), me);

module.exports = router;
