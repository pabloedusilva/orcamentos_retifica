const express = require('express');
const router = express.Router();
const { list, create, updateStatus, update, remove, pdf } = require('../../controllers/orcamentos.controller');
const { auth } = require('../../middlewares/auth');

router.get('/', auth(true), list);
router.post('/', auth(true), create);
router.patch('/:id/status', auth(true), updateStatus);
router.put('/:id', auth(true), update);
router.delete('/:id', auth(true), remove);
router.get('/:id/pdf', auth(true), pdf);

module.exports = router;
