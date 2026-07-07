const express = require('express');
const router = express.Router();
const { getAll, upsertSlot, deleteSlot, getConflicts, generateSemester } = require('../controllers/timetableController');

router.get('/', getAll);
router.post('/slot', upsertSlot);
router.delete('/slot/:id', deleteSlot);
router.get('/conflicts', getConflicts);
router.post('/generate-semester', generateSemester);

module.exports = router;
