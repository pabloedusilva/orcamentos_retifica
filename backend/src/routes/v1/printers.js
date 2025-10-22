const express = require('express');
const router = express.Router();
const { auth } = require('../../middlewares/auth');
const ctrl = require('../../controllers/printers.controller');

router.get('/', auth(true), ctrl.list);
router.get('/default', auth(true), ctrl.getDefault);
router.get('/status/default', auth(true), ctrl.statusDefault);
router.post('/test', auth(true), ctrl.testConnectivity);
// New connected endpoints
router.get('/connected', auth(true), ctrl.getConnected);
router.get('/status/connected', auth(true), ctrl.statusConnected);
router.get('/status/:id', auth(true), ctrl.statusById);
router.post('/:id/connect', auth(true), ctrl.connectPrinter);
router.post('/:id/disconnect', auth(true), ctrl.disconnectPrinter);
router.post('/', auth(true), ctrl.create);
router.put('/:id', auth(true), ctrl.update);
router.delete('/:id', auth(true), ctrl.remove);
router.post('/:id/default', auth(true), ctrl.markDefault);

module.exports = router;
