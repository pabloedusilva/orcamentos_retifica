const express = require('express');
const router = express.Router();
const { auth } = require('../../middlewares/auth');
const { sendOrcamento } = require('../../controllers/email.controller');

// POST /api/v1/email/send-orcamento - Enviar orçamento por e-mail
router.post('/send-orcamento', auth(true), sendOrcamento);

module.exports = router;
