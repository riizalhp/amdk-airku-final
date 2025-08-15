
const Order = require('../models/orderModel');

const getOrders = async (req, res) => {
    try {
        const orders = await Order.getAll();
        res.json(orders);
    } catch (error) {
        console.error('Error getting orders:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const getOrderById = async (req, res) => {
    try {
        const order = await Order.getById(req.params.id);
        if (order) {
            res.json(order);
        } else {
            res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
        }
    } catch (error) {
        console.error(`Error getting order ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const createOrder = async (req, res) => {
    const { storeId, items, desiredDeliveryDate } = req.body;
    
    if (!storeId || !items || items.length === 0) {
        return res.status(400).json({ message: 'Harap sediakan ID toko dan item pesanan.' });
    }

    try {
        const creatorId = req.user.id; // Dapatkan ID pengguna dari token yang sudah diverifikasi

        const newOrder = await Order.create({ storeId, items, desiredDeliveryDate, creatorId });
        res.status(201).json(newOrder);
    } catch (error) {
        console.error('DETAIL ERROR SAAT CREATE ORDER:', error);
        // Periksa pesan error spesifik dari model
        if (error.message.startsWith('Stok tidak mencukupi') || error.message.includes('login kembali')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Gagal membuat pesanan, terjadi kesalahan pada server.' });
    }
};

const updateOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.getById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
        }

        const updatedOrder = await Order.update(orderId, req.body);
        res.json(updatedOrder);
    } catch (error) {
        console.error(`Error updating order ${req.params.id}:`, error);
        if (error.message.startsWith('Stok tidak mencukupi')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Gagal memperbarui pesanan, terjadi kesalahan pada server.' });
    }
};

const deleteOrder = async (req, res) => {
    try {
        const order = await Order.getById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
        }

        if (order.status !== 'Pending') {
            return res.status(400).json({ message: 'Hanya pesanan dengan status "Pending" yang dapat dihapus.' });
        }

        const success = await Order.delete(req.params.id);
        if (success) {
            res.json({ message: 'Pesanan berhasil dihapus.' });
        } else {
            res.status(500).json({ message: 'Gagal menghapus pesanan.' });
        }
    } catch (error) {
        console.error(`Error deleting order ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const orderId = req.params.id;
        
        const order = await Order.getById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
        }

        const updatedOrder = await Order.updateStatus(orderId, status, order.items);
        res.json(updatedOrder);
    } catch (error) {
         console.error(`Error updating order status ${req.params.id}:`, error);
        res.status(500).json({ message: 'Gagal memperbarui status pesanan.' });
    }
};

const batchAssignVehicle = async (req, res) => {
    const { orderIds, vehicleId } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0 || !vehicleId) {
        return res.status(400).json({ message: 'Harap sediakan ID pesanan dan ID armada.' });
    }

    try {
        const result = await Order.batchAssignVehicle(orderIds, vehicleId);
        res.json({ message: `${result.affectedRows} pesanan berhasil ditugaskan.` });
    } catch (error) {
        console.error('Error in batchAssignVehicle controller:', error);
        res.status(500).json({ message: 'Gagal menugaskan pesanan secara massal.' });
    }
};

module.exports = {
    getOrders,
    getOrderById,
    createOrder,
    updateOrder,
    deleteOrder,
    updateOrderStatus,
    batchAssignVehicle
};
