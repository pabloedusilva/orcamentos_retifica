const express = require('express');
const router = express.Router();

const authRoutes = require('./v1/auth');
const clienteRoutes = require('./v1/clientes');
const pecaRoutes = require('./v1/pecas');
const servicoRoutes = require('./v1/servicos');
const orcRoutes = require('./v1/orcamentos');
const filesRoutes = require('./v1/files');
const settingsRoutes = require('./v1/settings');
const emailRoutes = require('./v1/email');

router.use('/v1/auth', authRoutes);
router.use('/v1/clientes', clienteRoutes);
router.use('/v1/pecas', pecaRoutes);
router.use('/v1/servicos', servicoRoutes);
router.use('/v1/orcamentos', orcRoutes);
router.use('/v1/files', filesRoutes);
router.use('/v1/settings', settingsRoutes);
router.use('/v1/email', emailRoutes);

module.exports = { router };
