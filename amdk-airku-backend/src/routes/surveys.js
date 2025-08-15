
const express = require('express');
const router = express.Router();
const { getSurveys, createSurvey } = require('../controllers/surveyController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getSurveys)
    .post(protect, createSurvey);

module.exports = router;
