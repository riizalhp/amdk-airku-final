
const Vehicle = require('../models/vehicleModel');

const getVehicles = async (req, res) => {
    try {
        const vehicles = await Vehicle.getAll();
        res.json(vehicles);
    } catch (error) {
        console.error('Error getting vehicles:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const getVehicleById = async (req, res) => {
    try {
        const vehicle = await Vehicle.getById(req.params.id);
        if (vehicle) {
            res.json(vehicle);
        } else {
            res.status(404).json({ message: 'Armada tidak ditemukan.' });
        }
    } catch (error) {
        console.error(`Error getting vehicle ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const createVehicle = async (req, res) => {
    const { plateNumber, model, capacity, status, region } = req.body;
    if (!plateNumber || !model || capacity === undefined || !status || !region) {
        return res.status(400).json({ message: 'Harap isi semua kolom yang diperlukan.' });
    }
    try {
        const newVehicle = await Vehicle.create(req.body);
        res.status(201).json(newVehicle);
    } catch (error) {
        console.error('Error creating vehicle:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const updateVehicle = async (req, res) => {
    try {
        const vehicle = await Vehicle.getById(req.params.id);
        if (!vehicle) {
            return res.status(404).json({ message: 'Armada tidak ditemukan.' });
        }
        
        const updatedVehicleData = { ...vehicle, ...req.body };
        const result = await Vehicle.update(req.params.id, updatedVehicleData);
        res.json(result);
    } catch (error) {
        console.error(`Error updating vehicle ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const deleteVehicle = async (req, res) => {
    try {
        const vehicle = await Vehicle.getById(req.params.id);
        if (!vehicle) {
            return res.status(404).json({ message: 'Armada tidak ditemukan.' });
        }
        
        const hasDependencies = await Vehicle.checkDependencies(req.params.id);
        if (hasDependencies) {
            return res.status(400).json({ message: 'Tidak dapat menghapus armada ini karena masih memiliki pesanan atau rute yang ditugaskan.' });
        }

        const success = await Vehicle.delete(req.params.id);
        if(success) {
            res.json({ message: 'Armada berhasil dihapus.' });
        } else {
            res.status(500).json({ message: 'Gagal menghapus armada.' });
        }
    } catch (error) {
        console.error(`Error deleting vehicle ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const updateTripStatus = async (req, res) => {
    const { id: vehicleId } = req.params;
    const { action } = req.body; // 'start' or 'complete'
    
    if (!action || !['start', 'complete'].includes(action)) {
        return res.status(400).json({ message: 'Aksi tidak valid.' });
    }

    try {
        const vehicle = await Vehicle.getById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({ message: 'Armada tidak ditemukan.' });
        }
        
        const newStatus = action === 'start' ? 'Sedang Mengirim' : 'Idle';

        if (vehicle.status === newStatus) {
            return res.json({ message: `Armada sudah dalam status '${newStatus}'.` });
        }

        await Vehicle.update(vehicleId, { ...vehicle, status: newStatus });
        res.json({ message: `Status armada berhasil diperbarui ke '${newStatus}'.` });

    } catch (error) {
        console.error(`Error updating trip status for vehicle ${vehicleId}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const getVehicleAssignments = async (req, res) => {
    try {
        const assignments = await Vehicle.getAllWithAssignedOrders();
        res.json(assignments);
    } catch (error) {
        console.error('Error getting vehicle assignments:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

module.exports = {
    getVehicles,
    getVehicleById,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    updateTripStatus,
    getVehicleAssignments
};
