const express = require('express');
const router = express.Router();
const { list, create, update, remove } = require('../../controllers/servicos.controller');
const { auth } = require('../../middlewares/auth');

router.get('/', auth(true), list);
router.post('/', auth(true), create);
router.put('/:id', auth(true), update);
router.delete('/:id', auth(true), remove);

module.exports = router;
