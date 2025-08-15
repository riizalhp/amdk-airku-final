const express = require('express');
const router = express.Router();
const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');

// Rute untuk mendapatkan semua produk dan membuat produk baru
router.route('/')
    .get(protect, getProducts) // Semua pengguna terotentikasi bisa melihat produk
    .post(protect, admin, createProduct); // Hanya admin yang bisa membuat produk

// Rute untuk mendapatkan, memperbarui, dan menghapus produk berdasarkan ID
router.route('/:id')
    .get(protect, getProductById)
    .put(protect, admin, updateProduct)
    .delete(protect, admin, deleteProduct);

module.exports = router;
