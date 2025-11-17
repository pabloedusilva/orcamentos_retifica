const express = require('express');
const router = express.Router();
const { auth } = require('../../middlewares/auth');
const ctrl = require('../../controllers/printers.controller');

// All endpoints require authentication
router.get('/current', auth(true), ctrl.getCurrent);
router.post('/connect', auth(true), ctrl.connect);
router.get('/scan', auth(true), ctrl.scan);
router.post('/print', auth(true), ctrl.print);

module.exports = router;
