const checkRegion = async (req, res) => {
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
        return res.status(400).json({ success: false, message: 'Latitude (lat) and Longitude (lng) are required.' });
    }

    try {
        let region;
        // Simple classification based on longitude, as per frontend comments
        // Titik penentu wilayah Timur dan Barat adalah garis bujur (longitude) kantor PDAM Tirta Binangun di 110.1486773.
        if (lng > 110.1486773) {
            region = "Timur";
        } else {
            region = "Barat";
        }
        res.json({ success: true, region });
    } catch (error) {
        console.error('Error checking region:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to check region.' });
    }
};

module.exports = {
    checkRegion,
};