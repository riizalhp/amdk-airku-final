const Store = require('../models/storeModel');
const { geocodeAddress } = require('../services/geocodingService'); // Impor service baru
const { classifyStoreRegion } = require('../services/geminiService');

function extractCoordsFromMapsUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
  const match = url.match(regex);
  if (match && match[1] && match[2]) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return null;
}

async function getCoordinates(data) {
  // Prioritas 1: Koordinat dari GPS Sales (jika dikirim langsung)
  if (data.lat && data.lng) {
    return { lat: parseFloat(data.lat), lng: parseFloat(data.lng) };
  }

  // Prioritas 2: Ekstrak dari Link Google Maps
  const coordsFromUrl = extractCoordsFromMapsUrl(data.address);
  if (coordsFromUrl) {
    return coordsFromUrl;
  }

  // Prioritas 3: Geocoding dari Alamat Teks (untuk Admin)
  if (data.address) {
    return await geocodeAddress(data.address);
  }

  return null; // Jika semua gagal
}

const createStore = async (req, res) => {
  try {
    const storeData = { ...req.body };
    const coords = await getCoordinates(storeData);

    storeData.lat = coords ? coords.lat : null;
    storeData.lng = coords ? coords.lng : null;

    const newStore = await Store.create(storeData);
    res.status(201).json(newStore);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateStore = async (req, res) => {
  try {
    const storeData = { ...req.body };
    const coords = await getCoordinates(storeData);

    storeData.lat = coords ? coords.lat : null;
    storeData.lng = coords ? coords.lng : null;

    const updatedStore = await Store.update(req.params.id, storeData);
    if (updatedStore) {
      res.json(updatedStore);
    } else {
      res.status(404).json({ message: 'Store not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllStores = async (req, res) => {
    try {
        const stores = await Store.getAll();
        res.json(stores);
    } catch (error) {
        console.error('Error getting stores:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const getStoreById = async (req, res) => {
    try {
        const store = await Store.getById(req.params.id);
        if (store) {
            res.json(store);
        } else {
            res.status(404).json({ message: 'Toko tidak ditemukan.' });
        }
    } catch (error) {
        console.error(`Error getting store ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const deleteStore = async (req, res) => {
    try {
        const store = await Store.getById(req.params.id);
        if (!store) {
            return res.status(404).json({ message: 'Toko tidak ditemukan.' });
        }
        
        const hasDependencies = await Store.checkDependencies(req.params.id);
        if (hasDependencies) {
            return res.status(400).json({ message: 'Tidak dapat menghapus toko ini karena masih memiliki pesanan, jadwal kunjungan, atau riwayat perjalanan yang terkait.' });
        }

        const success = await Store.delete(req.params.id);
        if(success) {
            res.json({ message: 'Toko berhasil dihapus.' });
        } else {
            res.status(500).json({ message: 'Gagal menghapus toko.' });
        }
    } catch (error) {
        console.error(`Error deleting store ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const classifyRegion = async (req, res) => {
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
        return res.status(400).json({ message: 'Koordinat latitude dan longitude wajib diisi.' });
    }

    try {
        const result = await classifyStoreRegion({ lat, lng });
        res.json(result);
    } catch (error) {
        console.error('Error in classifyRegion controller:', error);
        res.status(500).json({ message: 'Gagal mengklasifikasikan wilayah toko.' });
    }
};

const geocodeAndClassify = async (req, res) => {
    const { address } = req.body;

    if (!address) {
        return res.status(400).json({ message: 'Alamat wajib diisi.' });
    }

    try {
        const coordinates = await geocodeAddress(address);
        if (!coordinates) {
            return res.status(404).json({ 
                success: false, 
                message: 'Tidak dapat menemukan koordinat untuk alamat tersebut.' 
            });
        }

        const regionResult = await classifyStoreRegion(coordinates);
        
        res.json({
            success: true,
            coordinates,
            region: regionResult.region,
            message: 'Alamat berhasil di-geocode dan wilayah diklasifikasikan.'
        });

    } catch (error) {
        console.error('Error in geocodeAndClassify controller:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal melakukan geocoding dan klasifikasi alamat.' 
        });
    }
};


module.exports = {
    getAllStores,
    getStoreById,
    createStore,
    updateStore,
    deleteStore,
    classifyRegion,
    geocodeAndClassify,
};