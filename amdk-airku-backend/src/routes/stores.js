const express = require('express');
const router = express.Router();
const {
    getAllStores,
    getStoreById,
    createStore,
    updateStore,
    deleteStore,
    classifyRegion,
    geocodeAndClassify
} = require('../controllers/storeController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getAllStores)
    .post(protect, admin, createStore);

router.route('/:id')
    .get(protect, getStoreById)
    .put(protect, admin, updateStore)
    .delete(protect, admin, deleteStore);

// Route for AI-based region classification
router.post('/classify-region', protect, classifyRegion);

// New route for combined geocoding and classification
router.post('/geocode-classify', protect, admin, geocodeAndClassify);

module.exports = router;