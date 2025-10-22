const express = require('express');
const router = express.Router();
const { auth } = require('../../middlewares/auth');
const settingsController = require('../../controllers/settings.controller');
const rateLimit = require('express-rate-limit');

// Todas as rotas de settings requerem autenticação
router.use(auth());

// GET /api/v1/settings - Buscar configurações
router.get('/', settingsController.getSettings);

// PUT /api/v1/settings - Atualizar configurações
router.put('/', settingsController.updateSettings);

// GET /api/v1/settings/user - Buscar dados do usuário
router.get('/user', settingsController.getUserInfo);

// PUT /api/v1/settings/account - Atualizar conta do usuário
// Apply strict rate limit to account updates (mitigate brute-force)
// Make account rate limit configurable via env.
let accountLimiter = (req, res, next) => next();
if (process.env.ACCOUNT_RATE_LIMIT_DISABLED === '1') {
	// disabled by env
	accountLimiter = (req, res, next) => next();
} else {
	const windowMinutes = parseInt(process.env.ACCOUNT_RATE_LIMIT_WINDOW_MIN || '30', 10);
	const maxAttempts = parseInt(process.env.ACCOUNT_RATE_LIMIT_MAX || '6', 10);
	accountLimiter = rateLimit({
		windowMs: windowMinutes * 60 * 1000,
		max: maxAttempts,
		standardHeaders: true,
		legacyHeaders: false,
		message: { error: 'Muitas tentativas. Tente novamente mais tarde.' }
	});
}

router.put('/account', accountLimiter, settingsController.updateAccount);

module.exports = router;
