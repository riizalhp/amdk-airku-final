const NodeGeocoder = require('node-geocoder');

const options = {
  provider: 'openstreetmap', // Menggunakan provider gratis OpenStreetMap
};

const geocoder = NodeGeocoder(options);

/**
 * Mengubah alamat teks menjadi koordinat lat/lng
 * @param {string} address - Alamat yang akan di-geocode
 * @returns {Promise<{lat: number, lng: number}|null>}
 */
const geocodeAddress = async (address) => {
  try {
    const res = await geocoder.geocode(address);
    if (res.length > 0) {
      const { latitude, longitude } = res[0];
      return { lat: latitude, lng: longitude };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null;
  }
};

module.exports = { geocodeAddress };