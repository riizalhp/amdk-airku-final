const express = require('express');
const router = express.Router();
const {
    getAllStores,
    getStoreById,
    createStore,
    updateStore,
    deleteStore,
} = require('../controllers/storeController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getAllStores)
    .post(protect, admin, createStore);

router.route('/:id')
    .get(protect, getStoreById)
    .put(protect, admin, updateStore)
    .delete(protect, admin, deleteStore);

module.exports = router;