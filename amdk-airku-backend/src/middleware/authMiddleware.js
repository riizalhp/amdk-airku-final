const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Dapatkan token dari header
            token = req.headers.authorization.split(' ')[1];

            // Verifikasi token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Lampirkan payload pengguna ke objek request
            req.user = decoded;

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Tidak terotorisasi, token gagal' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Tidak terotorisasi, tidak ada token' });
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'Admin') {
        next();
    } else {
        res.status(403).json({ message: 'Akses ditolak, hanya untuk Admin' });
    }
};

module.exports = { protect, admin };
