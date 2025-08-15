const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const User = {
    getAll: async () => {
        const query = 'SELECT id, name, email, role FROM users';
        const [rows] = await pool.query(query);
        return rows;
    },

    getById: async (id, connection = pool) => {
        const query = 'SELECT id, name, email, role FROM users WHERE id = ?';
        const [rows] = await pool.query(query, [id]);
        return rows[0];
    },
    
    findByEmail: async (email) => {
        const query = 'SELECT * FROM users WHERE email = ?';
        const [rows] = await pool.query(query, [email]);
        return rows[0];
    },

    create: async (userData) => {
        const { name, email, role, password } = userData;
        const id = randomUUID();
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (id, name, email, role, password) VALUES (?, ?, ?, ?, ?)';
        
        await pool.query(query, [id, name, email, role, hashedPassword]);
        return await User.getById(id);
    },

    update: async (id, userData) => {
        const { name, email, role, password } = userData;
        let query;
        let params;

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query = 'UPDATE users SET name = ?, email = ?, role = ?, password = ? WHERE id = ?';
            params = [name, email, role, hashedPassword, id];
        } else {
            query = 'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?';
            params = [name, email, role, id];
        }
        
        await pool.query(query, params);
        return await User.getById(id);
    },

    delete: async (id) => {
        const query = 'DELETE FROM users WHERE id = ?';
        const [result] = await pool.query(query, [id]);
        return result.affectedRows > 0;
    },

    checkDependencies: async (userId) => {
        const queries = [
            { table: 'route_plans', column: 'driverId', message: 'Driver memiliki rute yang ditugaskan.' },
            { table: 'visits', column: 'salesPersonId', message: 'Sales memiliki data kunjungan terkait.' },
            { table: 'survey_responses', column: 'salesPersonId', message: 'Sales memiliki data survei terkait.' },
            { table: 'orders', column: 'orderedById', message: 'Pengguna telah membuat pesanan.' } // Assuming orderedBy.id is stored in 'orderedById'
        ];
        
        try {
            for (const dep of queries) {
                 const q = `SELECT id FROM ${dep.table} WHERE ${dep.column} = ? LIMIT 1`;
                 const [rows] = await pool.query(q, [userId]);
                 if(rows.length > 0) return { hasDependency: true, message: dep.message };
            }
            return { hasDependency: false };
        } catch (error) {
            if (error.code === 'ER_NO_SUCH_TABLE') {
                console.warn(`Dependency check failed because a table doesn't exist: ${error.message}`);
                return { hasDependency: false };
            }
            throw error;
        }
    }
};

module.exports = User;