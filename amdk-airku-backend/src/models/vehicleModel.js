const pool = require('../config/db');
const { randomUUID } = require('crypto');

const Vehicle = {
    getAll: async () => {
        const query = 'SELECT * FROM vehicles';
        const [rows] = await pool.query(query);
        return rows;
    },

    getById: async (id, connection = pool) => {
        const query = 'SELECT * FROM vehicles WHERE id = ?';
        const [rows] = await pool.query(query, [id]);
        return rows[0];
    },

    create: async (vehicleData) => {
        const { plateNumber, model, capacity, status, region } = vehicleData;
        const id = randomUUID();
        const query = 'INSERT INTO vehicles (id, plateNumber, model, capacity, status, region) VALUES (?, ?, ?, ?, ?, ?)';
        
        await pool.query(query, [id, plateNumber, model, capacity, status, region]);
        const [newVehicle] = await pool.query('SELECT * FROM vehicles WHERE id = ?', [id]);
        return newVehicle[0];
    },

    update: async (id, vehicleData) => {
        const { plateNumber, model, capacity, status, region } = vehicleData;
        const query = 'UPDATE vehicles SET plateNumber = ?, model = ?, capacity = ?, status = ?, region = ? WHERE id = ?';
        
        await pool.query(query, [plateNumber, model, capacity, status, region, id]);
        return { id, ...vehicleData };
    },

    delete: async (id) => {
        const query = 'DELETE FROM vehicles WHERE id = ?';
        const [result] = await pool.query(query, [id]);
        return result.affectedRows > 0;
    },

    checkDependencies: async (vehicleId) => {
        try {
            const orderQuery = 'SELECT id FROM orders WHERE assignedVehicleId = ? LIMIT 1';
            const [orders] = await pool.query(orderQuery, [vehicleId]);
            if (orders.length > 0) return true;

            const routeQuery = 'SELECT id FROM route_plans WHERE vehicleId = ? LIMIT 1';
            const [routes] = await pool.query(routeQuery, [vehicleId]);
            if (routes.length > 0) return true;

            return false;
        } catch (error) {
            if (error.code === 'ER_NO_SUCH_TABLE') {
                console.warn(`Dependency check failed because a table doesn\'t exist: ${error.message}`);
                return false;
            }
            throw error;
        }
    },

    getAllWithAssignedOrders: async () => {
        const [vehicles] = await pool.query('SELECT * FROM vehicles ORDER BY plateNumber ASC');
        const [orders] = await pool.query(`
            SELECT 
                o.id, 
                o.assignedVehicleId, 
                o.status, 
                s.name as storeName
            FROM orders o
            JOIN stores s ON o.storeId = s.id
            WHERE o.assignedVehicleId IS NOT NULL AND o.status = 'Pending'
            ORDER BY o.orderDate ASC
        `);

        const ordersByVehicle = orders.reduce((acc, order) => {
            if (!acc[order.assignedVehicleId]) {
                acc[order.assignedVehicleId] = [];
            }
            acc[order.assignedVehicleId].push(order);
            return acc;
        }, {});

        return vehicles.map(vehicle => ({
            ...vehicle,
            assignedOrders: ordersByVehicle[vehicle.id] || []
        }));
    }
};

module.exports = Vehicle;