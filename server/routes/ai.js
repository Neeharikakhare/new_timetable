const express = require('express');
const router = express.Router();
const { suggestReplacement, markAttendance, getAttendance } = require('../controllers/aiController');

router.post('/suggest-replacement', suggestReplacement);
router.post('/attendance', markAttendance);
router.get('/attendance', getAttendance);

module.exports = router;
