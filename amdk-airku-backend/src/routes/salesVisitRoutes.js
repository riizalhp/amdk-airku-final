const express = require('express');
const router = express.Router();
const { 
    createSalesVisitPlan,
    getSalesVisitPlans,
    deleteSalesVisitPlan
} = require('../controllers/salesVisitRouteController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/plan')
    .post(protect, createSalesVisitPlan);

router.route('/')
    .get(protect, getSalesVisitPlans);

router.route('/:id')
    .delete(protect, admin, deleteSalesVisitPlan);

module.exports = router;