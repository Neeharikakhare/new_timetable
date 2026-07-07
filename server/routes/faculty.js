const express = require('express');
const router = express.Router();
const { getAll, create, update, remove, bulkCreate } = require('../controllers/facultyController');

router.get('/', getAll);
router.post('/', create);
router.post('/bulk', bulkCreate);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
