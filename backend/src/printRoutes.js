const express = require('express');
const router = express.Router();
const { printHandler } = require('./printController');

// Rota única: recebe { pdfPath } no body e executa o fluxo completo
router.post('/', express.json({ limit: '1mb' }), printHandler);

module.exports = router;
