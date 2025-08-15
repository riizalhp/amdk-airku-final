const User = require('../models/userModel');

const getUsers = async (req, res) => {
    try {
        const users = await User.getAll();
        res.json(users);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const getUserById = async (req, res) => {
    try {
        const user = await User.getById(req.params.id);
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
        }
    } catch (error) {
        console.error(`Error getting user ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const createUser = async (req, res) => {
    const { name, email, role, password } = req.body;
    if (!name || !email || !role || !password) {
        return res.status(400).json({ message: 'Harap isi semua kolom yang diperlukan.' });
    }
    
    try {
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'Email sudah digunakan.' });
        }
        
        const newUser = await User.create({ name, email, role, password });
        res.status(201).json(newUser);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const updateUser = async (req, res) => {
    try {
        const user = await User.getById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
        }
        
        const updatedUserData = { ...user, ...req.body };
        const result = await User.update(req.params.id, updatedUserData);
        res.json(result);
    } catch (error) {
        console.error(`Error updating user ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const deleteUser = async (req, res) => {
    try {
        if (req.user.id === req.params.id) {
            return res.status(400).json({ message: 'Anda tidak dapat menghapus akun Anda sendiri.' });
        }

        const user = await User.getById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
        }
        
        const { hasDependency, message } = await User.checkDependencies(req.params.id);
        if (hasDependency) {
            return res.status(400).json({ message: message });
        }

        const success = await User.delete(req.params.id);
        if(success) {
            res.json({ message: 'Pengguna berhasil dihapus.' });
        } else {
            res.status(500).json({ message: 'Gagal menghapus pengguna.' });
        }
    } catch (error) {
        console.error(`Error deleting user ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

module.exports = {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
};