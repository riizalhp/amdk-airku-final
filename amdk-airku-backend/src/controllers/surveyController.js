
const Survey = require('../models/surveyModel');

const getSurveys = async (req, res) => {
    try {
        let surveys;
        if (req.user.role === 'Admin') {
            surveys = await Survey.getAll();
        } else {
            surveys = await Survey.getBySalesPersonId(req.user.id);
        }
        res.json(surveys);
    } catch (error) {
        console.error('Error getting surveys:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const createSurvey = async (req, res) => {
    try {
        const surveyData = {
            ...req.body,
            salesPersonId: req.user.id // Always attribute to the logged-in user
        };
        const newSurvey = await Survey.create(surveyData);
        res.status(201).json(newSurvey);
    } catch (error) {
        console.error('Error creating survey:', error);
        res.status(500).json({ message: 'Gagal mengirimkan laporan survei.' });
    }
};

module.exports = { getSurveys, createSurvey };
