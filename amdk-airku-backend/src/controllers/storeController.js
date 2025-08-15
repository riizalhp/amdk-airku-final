const Store = require('../models/storeModel');
const { classifyStoreRegion } = require('../services/geminiService');

const getStores = async (req, res) => {
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

const createStore = async (req, res) => {
    const { name, address, location, region, owner, phone, isPartner, partnerCode } = req.body;
    if (!name || !address || !location || !region || !owner || !phone) {
        return res.status(400).json({ message: 'Harap isi semua kolom yang diperlukan.' });
    }
    try {
        const newStoreData = {
            ...req.body,
            subscribedSince: new Date().toISOString().split('T')[0],
            lastOrder: 'N/A'
        };
        const newStore = await Store.create(newStoreData);
        res.status(201).json(newStore);
    } catch (error) {
        console.error('Error creating store:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const updateStore = async (req, res) => {
    try {
        const store = await Store.getById(req.params.id);
        if (!store) {
            return res.status(404).json({ message: 'Toko tidak ditemukan.' });
        }
        
        const updatedStoreData = { ...store, ...req.body };
        const result = await Store.update(req.params.id, updatedStoreData);
        res.json(result);
    } catch (error) {
        console.error(`Error updating store ${req.params.id}:`, error);
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
            return res.status(400).json({ message: 'Tidak dapat menghapus toko ini karena masih memiliki pesanan atau jadwal kunjungan yang terkait.' });
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

module.exports = {
    getStores,
    getStoreById,
    createStore,
    updateStore,
    deleteStore,
    classifyRegion,
};