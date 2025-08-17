

const pool = require('../config/db');
const { randomUUID } = require('crypto');

// Helper to transform database rows to match frontend type
const transformRowToStore = (row) => {
    if (!row) return undefined;
    const { lat, lng, ...rest } = row;
    // Convert tinyint(1) from DB (0 or 1) to a boolean for the frontend
    return { ...rest, isPartner: row.isPartner == 1, location: { lat, lng } };
};

const Store = {
    getAll: async () => {
        const query = 'SELECT * FROM stores ORDER BY subscribedSince DESC, id DESC';
        const [rows] = await pool.query(query);
        return rows.map(transformRowToStore);
    },

    getById: async (id) => {
        const query = 'SELECT * FROM stores WHERE id = ?';
        const [rows] = await pool.query(query, [id]);
        return transformRowToStore(rows[0]);
    },

    create: async (storeData) => {
        const { name, address, location, region, owner, phone, subscribedSince, lastOrder, isPartner, partnerCode } = storeData;
        const id = randomUUID();
        const { lat, lng } = location;
        const query = `
            INSERT INTO stores (id, name, address, lat, lng, region, owner, phone, subscribedSince, lastOrder, isPartner, partnerCode) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await pool.query(query, [id, name, address, lat, lng, region, owner, phone, subscribedSince, lastOrder, isPartner || false, partnerCode || null]);
        return await Store.getById(id);
    },

    update: async (id, storeData) => {
        const { name, address, location, region, owner, phone, subscribedSince, lastOrder, isPartner, partnerCode } = storeData;
        const { lat, lng } = location;
        const query = `
            UPDATE stores SET 
            name = ?, address = ?, lat = ?, lng = ?, region = ?, owner = ?, phone = ?, 
            subscribedSince = ?, lastOrder = ?, isPartner = ?, partnerCode = ? 
            WHERE id = ?
        `;
        
        await pool.query(query, [name, address, lat, lng, region, owner, phone, subscribedSince, lastOrder, isPartner, partnerCode || null, id]);
        return await Store.getById(id);
    },

    delete: async (id) => {
        const query = 'DELETE FROM stores WHERE id = ?';
        const [result] = await pool.query(query, [id]);
        return result.affectedRows > 0;
    },

    checkDependencies: async (storeId) => {
        try {
            const orderQuery = 'SELECT id FROM orders WHERE storeId = ? LIMIT 1';
            const [orders] = await pool.query(orderQuery, [storeId]);
            if (orders.length > 0) return true;

            const visitQuery = 'SELECT id FROM visits WHERE storeId = ? LIMIT 1';
            const [visits] = await pool.query(visitQuery, [storeId]);
            if (visits.length > 0) return true;

            const routeStopQuery = 'SELECT id FROM route_stops WHERE storeId = ? LIMIT 1';
            const [routeStops] = await pool.query(routeStopQuery, [storeId]);
            if (routeStops.length > 0) return true;

            return false;
        } catch (error) {
            // If tables don't exist yet, it will throw an error.
            // In a real scenario, migrations handle table creation.
            // For now, we'll assume no dependencies if a table doesn't exist.
            if (error.code === 'ER_NO_SUCH_TABLE') {
                console.warn(`Dependency check failed because a table doesn't exist: ${error.message}`);
                return false;
            }
            throw error; // Re-throw other errors
        }
    }
};

module.exports = Store;