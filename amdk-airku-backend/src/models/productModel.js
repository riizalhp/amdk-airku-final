const pool = require('../config/db');
const { randomUUID } = require('crypto');

const Product = {
    getAll: async () => {
        const query = 'SELECT * FROM products';
        const [rows] = await pool.query(query);
        return rows;
    },

    getById: async (id) => {
        const query = 'SELECT * FROM products WHERE id = ?';
        const [rows] = await pool.query(query, [id]);
        return rows[0];
    },

    create: async (productData) => {
        const { sku, name, price, stock, capacityUnit } = productData;
        const id = randomUUID();
        const query = 'INSERT INTO products (id, sku, name, price, stock, capacityUnit, reservedStock) VALUES (?, ?, ?, ?, ?, ?, 0)';
        
        await pool.query(query, [id, sku, name, price, stock, capacityUnit]);
        const [newProduct] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
        return newProduct[0];
    },

    update: async (id, productData) => {
        const { sku, name, price, stock, capacityUnit, reservedStock } = productData;
        const query = 'UPDATE products SET sku = ?, name = ?, price = ?, stock = ?, capacityUnit = ?, reservedStock = ? WHERE id = ?';
        
        await pool.query(query, [sku, name, price, stock, capacityUnit, reservedStock, id]);
        return { id, ...productData };
    },

    delete: async (id) => {
        const query = 'DELETE FROM products WHERE id = ?';
        const [result] = await pool.query(query, [id]);
        return result.affectedRows > 0;
    },
};

module.exports = Product;