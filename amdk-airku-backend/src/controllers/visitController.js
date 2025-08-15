const Visit = require('../models/visitModel');

const getVisits = async (req, res) => {
    try {
        let visits;
        if (req.user.role === 'Admin') {
            visits = await Visit.getAll();
        } else {
            visits = await Visit.getBySalesPersonId(req.user.id);
        }
        res.json(visits);
    } catch (error) {
        console.error('Error getting visits:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const getVisitById = async (req, res) => {
    try {
        const visit = await Visit.getById(req.params.id);
        if (visit) {
            res.json(visit);
        } else {
            res.status(404).json({ message: 'Kunjungan tidak ditemukan.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const createVisit = async (req, res) => {
    try {
        const newVisit = await Visit.create({ ...req.body, salesPersonId: req.body.salesPersonId || req.user.id });
        res.status(201).json(newVisit);
    } catch (error) {
        console.error('Error creating visit:', error);
        res.status(500).json({ message: 'Gagal membuat kunjungan.' });
    }
};

const updateVisit = async (req, res) => {
    try {
        const visit = await Visit.getById(req.params.id);
        if (!visit) {
            return res.status(404).json({ message: 'Kunjungan tidak ditemukan.' });
        }

        // Security check: Sales can only update their own visits
        if (req.user.role === 'Sales' && visit.salesPersonId !== req.user.id) {
            return res.status(403).json({ message: 'Anda tidak diizinkan memperbarui kunjungan ini.' });
        }
        
        const updatedVisit = await Visit.update(req.params.id, req.body);
        res.json(updatedVisit);
    } catch (error) {
        console.error('Error updating visit:', error);
        res.status(500).json({ message: 'Gagal memperbarui kunjungan.' });
    }
};

const deleteVisit = async (req, res) => {
    try {
        const visit = await Visit.getById(req.params.id);
        if (!visit) {
            return res.status(404).json({ message: 'Kunjungan tidak ditemukan.' });
        }

        const dependency = await Visit.checkDependencies(req.params.id);
        if (dependency.hasDependency) {
            return res.status(400).json({ message: dependency.message });
        }

        const success = await Visit.delete(req.params.id);
        if (success) {
            res.json({ message: 'Kunjungan berhasil dihapus.' });
        } else {
            res.status(500).json({ message: 'Gagal menghapus kunjungan.' });
        }
    } catch (error) {
        console.error('Error deleting visit:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

module.exports = { getVisits, getVisitById, createVisit, updateVisit, deleteVisit };