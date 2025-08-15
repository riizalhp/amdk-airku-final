const express = require('express');
const router = express.Router();
const {
    getOrders,
    getOrderById,
    createOrder,
    updateOrder,
    deleteOrder,
    updateOrderStatus,
    batchAssignVehicle
} = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

// Rute untuk mendapatkan semua pesanan dan membuat pesanan baru
router.route('/')
    .get(protect, getOrders)
    .post(protect, createOrder); // Sales dan Admin dapat membuat pesanan

// Rute untuk mendapatkan, memperbarui, dan menghapus pesanan berdasarkan ID
router.route('/:id')
    .get(protect, getOrderById)
    .put(protect, admin, updateOrder) // Hanya Admin yang bisa edit
    .delete(protect, admin, deleteOrder); // Hanya Admin yang bisa hapus

router.route('/:id/status')
    .put(protect, admin, updateOrderStatus); // Hanya admin yang bisa mengubah status

router.route('/batch-assign')
    .post(protect, admin, batchAssignVehicle); // Menetapkan kendaraan ke beberapa pesanan sekaligus

module.exports = router;