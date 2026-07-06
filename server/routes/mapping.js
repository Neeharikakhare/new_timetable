const express = require('express');
const router = express.Router();
const { getAll, create, update, remove, getAutoCount } = require('../controllers/mappingController');

router.get('/', getAll);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);
router.get('/auto-count/:subject_id', getAutoCount);

module.exports = router;
