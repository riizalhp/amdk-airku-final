const { classifyRegionFromCoords } = require('../services/regionService');

const classifyStoreRegion = async (req, res) => {
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
        return res.status(400).json({ message: 'Latitude (lat) and Longitude (lng) are required.' });
    }

    try {
        const region = await classifyRegionFromCoords({ lat, lng });
        res.json({ region });
    } catch (error) {
        console.error('Error classifying region:', error);
        res.status(500).json({ message: error.message || 'Failed to classify region.' });
    }
};

module.exports = {
    classifyStoreRegion,
};