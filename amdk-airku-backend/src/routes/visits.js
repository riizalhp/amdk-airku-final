const express = require('express');
const router = express.Router();
const {
    getVisits,
    getVisitById,
    createVisit,
    updateVisit,
    deleteVisit
} = require('../controllers/visitController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getVisits)
    .post(protect, createVisit);

router.route('/:id')
    .get(protect, getVisitById)
    .put(protect, updateVisit)
    .delete(protect, admin, deleteVisit);

module.exports = router;