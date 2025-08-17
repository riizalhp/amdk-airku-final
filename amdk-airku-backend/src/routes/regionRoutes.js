const express = require('express');
const router = express.Router();
const { classifyStoreRegion } = require('../controllers/regionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/classify', protect, classifyStoreRegion);

module.exports = router;