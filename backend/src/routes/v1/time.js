const express = require('express');
const router = express.Router();
const { now } = require('../../controllers/time.controller');
const { auth } = require('../../middlewares/auth');

// Public or protected? Keep it public to avoid blocking clock on auth issues
router.get('/', now);

module.exports = router;
