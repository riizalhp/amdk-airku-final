const express = require('express');
const router = express.Router();
const { checkRegion } = require('../controllers/regionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/check', protect, checkRegion);

module.exports = router;