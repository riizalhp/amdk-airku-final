const Store = require('../models/storeModel');

const createStore = async (req, res) => {
  try {
    const newStore = await Store.create(req.body);
    res.status(201).json(newStore);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateStore = async (req, res) => {
  try {
    const updatedStore = await Store.update(req.params.id, req.body);
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

module.exports = {
    getAllStores,
    getStoreById,
    createStore,
    updateStore,
    deleteStore,
};