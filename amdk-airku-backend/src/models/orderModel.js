
const pool = require('../config/db');
const { randomUUID } = require('crypto');
const Product = require('./productModel');

const Order = {
    getAll: async () => {
        const ordersQuery = `
            SELECT 
                o.id, o.storeId, o.totalAmount, o.status, o.orderDate, o.desiredDeliveryDate, o.assignedVehicleId, o.orderedById, o.orderedByName, o.orderedByRole, o.priority,
                s.name as storeName, s.lat, s.lng
            FROM orders o
            JOIN stores s ON o.storeId = s.id
            ORDER BY o.orderDate DESC, o.id DESC
        `;
        const [orders] = await pool.query(ordersQuery);
        
        if (orders.length === 0) return [];
        
        const orderIds = orders.map(o => o.id);
        const placeholders = orderIds.map(() => '?').join(',');

        const itemsQuery = `SELECT id, orderId, productId, quantity, originalPrice, specialPrice FROM order_items WHERE orderId IN (${placeholders})`;
        const [items] = await pool.query(itemsQuery, orderIds);

        const itemsByOrderId = items.reduce((acc, item) => {
            if (!acc[item.orderId]) acc[item.orderId] = [];
            acc[item.orderId].push(item);
            return acc;
        }, {});

        return orders.map(order => {
            const { lat, lng, storeName, orderedById, orderedByName, orderedByRole, ...restOfOrder } = order;
            const orderItems = itemsByOrderId[order.id] || [];
            return {
                ...restOfOrder,
                storeName,
                location: { lat, lng },
                orderedBy: { id: orderedById, name: orderedByName, role: orderedByRole },
                priority: order.priority == 1,
                items: orderItems.map(({ productId, quantity, originalPrice, specialPrice }) => ({
                    productId,
                    quantity,
                    originalPrice,
                    specialPrice: specialPrice === null ? undefined : specialPrice,
                })),
            };
        });
    },
    getById: async (id, connection = pool) => {
        const orderQuery = `
            SELECT o.*, s.name as storeName, s.lat, s.lng 
            FROM orders o
            JOIN stores s ON o.storeId = s.id
            WHERE o.id = ?
        `;
        const [orderRows] = await connection.query(orderQuery, [id]);
        if (orderRows.length === 0) return null;

        const order = orderRows[0];
        
        const itemsQuery = 'SELECT * FROM order_items WHERE orderId = ?';
        const [itemRows] = await connection.query(itemsQuery, [id]);
        
        const { lat, lng, storeName, orderedById, orderedByName, orderedByRole, priority, ...restOfOrder } = order;
        return {
            ...restOfOrder,
            storeName,
            location: { lat, lng },
            orderedBy: { id: orderedById, name: orderedByName, role: orderedByRole },
            priority: priority == 1,
            items: itemRows.map(({ productId, quantity, originalPrice, specialPrice }) => ({
                productId,
                quantity,
                originalPrice,
                specialPrice: specialPrice === null ? undefined : specialPrice,
            }))
        };
    },
    create: async (orderData) => {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const { storeId, items, desiredDeliveryDate, creatorId } = orderData;
            
            // Verifikasi pembuat pesanan ada dan dapatkan data terbaru
            const [userRows] = await connection.query('SELECT id, name, role FROM users WHERE id = ?', [creatorId]);
            if (userRows.length === 0) {
                throw new Error('Pengguna yang membuat pesanan tidak ditemukan di database. Silakan logout dan login kembali.');
            }
            const orderedBy = userRows[0];

            // Ambil produk dan periksa stok di dalam transaksi
            const productIds = items.map(item => item.productId);
            const placeholders = productIds.map(() => '?').join(',');
            const [products] = await connection.query(`SELECT * FROM products WHERE id IN (${placeholders}) FOR UPDATE`, productIds);
            
            const itemsWithPrices = [];
            for (const item of items) {
                const product = products.find(p => p.id === item.productId);
                if (!product) throw new Error(`Produk dengan ID ${item.productId} tidak ditemukan.`);
                
                const availableStock = product.stock - product.reservedStock;
                if (item.quantity > availableStock) {
                    throw new Error(`Stok tidak mencukupi untuk ${product.name}. Tersedia: ${availableStock}, Diminta: ${item.quantity}.`);
                }
                itemsWithPrices.push({ ...item, originalPrice: product.price });
            }

            const totalAmount = itemsWithPrices.reduce((sum, item) => sum + (item.specialPrice ?? item.originalPrice) * item.quantity, 0);
            const orderId = randomUUID();
            
            const formattedDeliveryDate = (desiredDeliveryDate && desiredDeliveryDate.trim() !== '') ? desiredDeliveryDate : null;

            const orderQuery = `INSERT INTO orders (id, storeId, totalAmount, status, orderDate, desiredDeliveryDate, assignedVehicleId, orderedById, orderedByName, orderedByRole, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            await connection.query(orderQuery, [
                orderId, storeId, totalAmount, 'Pending', new Date().toISOString().split('T')[0],
                formattedDeliveryDate, null, orderedBy.id, orderedBy.name, orderedBy.role, false
            ]);
            
            const orderItemQuery = 'INSERT INTO order_items (id, orderId, productId, quantity, originalPrice, specialPrice) VALUES ?';
            const orderItemsData = itemsWithPrices.map(item => [
                randomUUID(), orderId, item.productId, item.quantity, item.originalPrice, item.specialPrice || null
            ]);
            await connection.query(orderItemQuery, [orderItemsData]);
            
            // Perbarui stok yang dipesan
            for (const item of items) {
                await connection.query('UPDATE products SET reservedStock = reservedStock + ? WHERE id = ?', [item.quantity, item.productId]);
            }

            await connection.commit();
            return await Order.getById(orderId, connection);

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },
    update: async (orderId, orderData) => {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const originalOrder = await Order.getById(orderId, connection);
            if (!originalOrder) {
                throw new Error("Order not found");
            }

            const { items, ...otherUpdates } = orderData;
            
            // Kembalikan reservasi stok asli
            for (const item of originalOrder.items) {
                await connection.query('UPDATE products SET reservedStock = GREATEST(0, reservedStock - ?) WHERE id = ?', [item.quantity, item.productId]);
            }

            // Periksa ketersediaan stok baru dan terapkan reservasi baru
            const productIds = items.map(item => item.productId);
            const placeholders = productIds.map(() => '?').join(',');
            const [products] = await connection.query(`SELECT * FROM products WHERE id IN (${placeholders}) FOR UPDATE`, productIds);

            for (const item of items) {
                const product = products.find(p => p.id === item.productId);
                if (!product) throw new Error(`Produk dengan ID ${item.productId} tidak ditemukan.`);
                
                const availableStock = product.stock - product.reservedStock;
                if (item.quantity > availableStock) {
                    throw new Error(`Stok tidak mencukupi untuk ${product.name}. Tersedia: ${availableStock}, Diminta: ${item.quantity}.`);
                }
            }
             for (const item of items) {
                await connection.query('UPDATE products SET reservedStock = reservedStock + ? WHERE id = ?', [item.quantity, item.productId]);
            }

            // Perbarui detail pesanan
            const totalAmount = items.reduce((sum, item) => {
                const product = products.find(p => p.id === item.productId);
                const price = item.specialPrice ?? product.price;
                return sum + (price * item.quantity);
            }, 0);
            
            const formattedDeliveryDate = (otherUpdates.desiredDeliveryDate && otherUpdates.desiredDeliveryDate.trim() !== '') ? otherUpdates.desiredDeliveryDate : null;
            
            const orderUpdateQuery = 'UPDATE orders SET totalAmount = ?, desiredDeliveryDate = ?, assignedVehicleId = ?, priority = ? WHERE id = ?';
            await connection.query(orderUpdateQuery, [totalAmount, formattedDeliveryDate, otherUpdates.assignedVehicleId || null, otherUpdates.priority || false, orderId]);

            // Ganti item pesanan
            await connection.query('DELETE FROM order_items WHERE orderId = ?', [orderId]);
            const orderItemQuery = 'INSERT INTO order_items (id, orderId, productId, quantity, originalPrice, specialPrice) VALUES ?';
            const orderItemsData = items.map(item => {
                const product = products.find(p => p.id === item.productId);
                if (!product) throw new Error(`Product with ID ${item.productId} not found while building item data.`);
                return [
                    randomUUID(), orderId, item.productId, item.quantity, product.price, item.specialPrice || null
                ];
            });
            if (orderItemsData.length > 0) {
              await connection.query(orderItemQuery, [orderItemsData]);
            }
            
            await connection.commit();
            return await Order.getById(orderId, connection);

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },
    delete: async (orderId) => {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const orderToDelete = await Order.getById(orderId, connection);
            if (!orderToDelete) {
                throw new Error('Order not found for deletion.');
            }
            if (orderToDelete.status !== 'Pending') {
                throw new Error('Only Pending orders can be deleted.');
            }

            // Kembalikan stok yang dipesan
            for (const item of orderToDelete.items) {
                await connection.query('UPDATE products SET reservedStock = GREATEST(0, reservedStock - ?) WHERE id = ?', [item.quantity, item.productId]);
            }
            
            await connection.query('DELETE FROM order_items WHERE orderId = ?', [orderId]);
            const [result] = await connection.query('DELETE FROM orders WHERE id = ?', [orderId]);
            
            await connection.commit();
            return result.affectedRows > 0;
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },
    findRoutableOrders: async ({ deliveryDate, vehicleRegion, vehicleId }, connection = pool) => {
        const query = `
            SELECT
                o.id,
                o.storeId,
                o.desiredDeliveryDate,
                o.priority,
                s.name as storeName,
                s.address,
                s.lat,
                s.lng,
                SUM(oi.quantity * p.capacityUnit) as demand
            FROM orders o
            JOIN stores s ON o.storeId = s.id
            JOIN order_items oi ON o.id = oi.orderId
            JOIN products p ON oi.productId = p.id
            WHERE
                o.status = 'Pending' AND
                (o.desiredDeliveryDate <= ? OR o.desiredDeliveryDate IS NULL) AND
                (o.assignedVehicleId = ? OR (o.assignedVehicleId IS NULL AND s.region = ?))
            GROUP BY o.id
            ORDER BY o.desiredDeliveryDate ASC
        `;
        const [rows] = await pool.query(query, [deliveryDate, vehicleId, vehicleRegion]);
        
        return rows.map(row => ({
            id: row.id,
            storeId: row.storeId,
            storeName: row.storeName,
            address: row.address,
            location: { lat: row.lat, lng: row.lng },
            demand: parseFloat(row.demand),
            priority: row.priority == 1
        }));
    },
    batchAssignVehicle: async (orderIds, vehicleId) => {
        if (!orderIds || orderIds.length === 0) {
            return { affectedRows: 0 };
        }
        const query = `
            UPDATE orders 
            SET assignedVehicleId = ? 
            WHERE id IN (?) AND status = 'Pending'
        `;
        const [result] = await pool.query(query, [vehicleId, orderIds]);
        return result;
    },

    getAssignedByVehicleId: async (vehicleId, connection = pool) => {
        const query = `
            SELECT
                o.id, o.storeId, o.priority,
                s.name as storeName, s.address, s.lat, s.lng,
                SUM(oi.quantity * p.capacityUnit) as demand
            FROM orders o
            JOIN stores s ON o.storeId = s.id
            JOIN order_items oi ON o.id = oi.orderId
            JOIN products p ON oi.productId = p.id
            WHERE o.status = 'Pending' AND o.assignedVehicleId = ?
            GROUP BY o.id
            ORDER BY o.priority DESC, o.orderDate ASC
        `;
        const [rows] = await connection.query(query, [vehicleId]);
        return rows.map(row => ({
            id: row.id,
            storeId: row.storeId,
            storeName: row.storeName,
            address: row.address,
            location: { lat: row.lat, lng: row.lng },
            demand: parseFloat(row.demand),
            priority: row.priority == 1
        }));
    }
};

module.exports = Order;
