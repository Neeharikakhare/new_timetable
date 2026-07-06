const express = require('express');
const router = express.Router();
const { getAll, create, update, remove, getBranches } = require('../controllers/subjectController');

router.get('/branches', getBranches);
router.get('/', getAll);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
