const pool = require('../config/db');
const { randomUUID } = require('crypto');

const Store = {
    getAll: async () => {
        const [rows] = await pool.query('SELECT * FROM stores ORDER BY name ASC');
        // Mengubah format agar sesuai dengan tipe `Store` di frontend
        return rows.map(row => ({
            ...row,
            location: { lat: row.lat, lng: row.lng },
            isPartner: row.isPartner === 1, // Konversi tinyint ke boolean
        }));
    },

    getById: async (id) => {
        const [rows] = await pool.query('SELECT * FROM stores WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        const row = rows[0];
        return {
            ...row,
            location: { lat: row.lat, lng: row.lng },
            isPartner: row.isPartner === 1,
        };
    },

    create: async (storeData) => {
        const { name, address, location, region, owner, phone, isPartner, partnerCode, subscribedSince, lastOrder } = storeData;
        const id = randomUUID();
        const query = `
            INSERT INTO stores (id, name, address, lat, lng, region, owner, phone, subscribedSince, lastOrder, isPartner, partnerCode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await pool.query(query, [id, name, address, location.lat, location.lng, region, owner, phone, subscribedSince, lastOrder, isPartner, partnerCode || null]);
        return { id, ...storeData };
    },

    update: async (id, storeData) => {
        const { name, address, location, region, owner, phone, isPartner, partnerCode } = storeData;
        const query = `
            UPDATE stores SET 
                name = ?, address = ?, lat = ?, lng = ?, region = ?, owner = ?, phone = ?, isPartner = ?, partnerCode = ?
            WHERE id = ?
        `;
        await pool.query(query, [name, address, location.lat, location.lng, region, owner, phone, isPartner, partnerCode || null, id]);
        return { id, ...storeData };
    },

    delete: async (id) => {
        const [result] = await pool.query('DELETE FROM stores WHERE id = ?', [id]);
        return result.affectedRows > 0;
    },

    checkDependencies: async (id) => {
        const [orders] = await pool.query('SELECT id FROM orders WHERE storeId = ? LIMIT 1', [id]);
        const [visits] = await pool.query('SELECT id FROM visits WHERE storeId = ? LIMIT 1', [id]);
        return orders.length > 0 || visits.length > 0;
    }
};

module.exports = Store;