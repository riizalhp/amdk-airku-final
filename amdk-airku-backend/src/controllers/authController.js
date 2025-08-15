
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email dan password wajib diisi.' });
    }

    try {
        const user = await User.findByEmail(email);

        if (!user) {
            return res.status(401).json({ message: 'Kredensial tidak valid.' });
        }

        // PENTING: Kode ini mengasumsikan password di database sudah di-hash.
        // Login akan gagal hingga database diisi dengan pengguna yang password-nya di-hash.
        // Contoh membuat hash: const hashedPassword = await bcrypt.hash('password123', 10);
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Kredensial tidak valid.' });
        }

        const payload = { id: user.id, name: user.name, role: user.role };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({
            message: 'Login berhasil',
            token,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Error saat login:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const register = async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Nama, email, peran, dan password wajib diisi.' });
    }

    const validRoles = ['Admin', 'Sales', 'Driver'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Peran yang dipilih tidak valid.' });
    }

    try {
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'Email sudah terdaftar. Silakan gunakan email lain.' });
        }
        
        await User.create({
            name,
            email,
            password,
            role
        });

        res.status(201).json({ message: 'Registrasi berhasil. Silakan masuk dengan akun baru Anda.' });

    } catch (error) {
        console.error('Error saat registrasi:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

module.exports = {
    login,
    register,
};
