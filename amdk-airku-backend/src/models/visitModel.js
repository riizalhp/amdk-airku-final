
const pool = require('../config/db');
const { randomUUID } = require('crypto');

const Visit = {
    getAll: async () => {
        const [rows] = await pool.query('SELECT * FROM visits ORDER BY visitDate DESC');
        return rows;
    },
    getBySalesPersonId: async (salesPersonId) => {
        const [rows] = await pool.query('SELECT * FROM visits WHERE salesPersonId = ? ORDER BY visitDate DESC', [salesPersonId]);
        return rows;
    },
    getById: async (id) => {
        const [rows] = await pool.query('SELECT * FROM visits WHERE id = ?', [id]);
        return rows[0];
    },
    create: async (visitData) => {
        const { storeId, salesPersonId, visitDate, purpose, notes } = visitData;
        const id = randomUUID();
        const query = `INSERT INTO visits (id, storeId, salesPersonId, visitDate, purpose, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        await pool.query(query, [id, storeId, salesPersonId, visitDate, purpose, 'Akan Datang', notes || null]);
        return await Visit.getById(id);
    },
    update: async (id, visitData) => {
        const originalVisit = await Visit.getById(id);
        if (!originalVisit) {
            throw new Error("Visit not found");
        }
        
        // Merge new data with original data to prevent accidental nulling of fields
        const dataToUpdate = { ...originalVisit, ...visitData };

        const { storeId, salesPersonId, visitDate, purpose, status, notes, proofOfVisitImage } = dataToUpdate;

        const query = `UPDATE visits SET 
            storeId = ?, salesPersonId = ?, visitDate = ?, purpose = ?, 
            status = ?, notes = ?, proofOfVisitImage = ? 
            WHERE id = ?`;

        await pool.query(query, [
            storeId, salesPersonId, visitDate, purpose, 
            status, notes, proofOfVisitImage, id
        ]);
        return await Visit.getById(id);
    },
    delete: async (id) => {
        const [result] = await pool.query('DELETE FROM visits WHERE id = ?', [id]);
        return result.affectedRows > 0;
    },
    checkDependencies: async (visitId) => {
        try {
            // This check assumes a sales_visit_route_stops table will exist.
            const query = 'SELECT visitId FROM sales_visit_route_stops WHERE visitId = ? LIMIT 1';
            const [rows] = await pool.query(query, [visitId]);
            if (rows.length > 0) {
                return { hasDependency: true, message: 'Tidak dapat menghapus jadwal kunjungan ini karena sudah menjadi bagian dari Rencana Rute Kunjungan.' };
            }
            return { hasDependency: false };
        } catch (error) {
            if (error.code === 'ER_NO_SUCH_TABLE') {
                console.warn(`Dependency check on sales_visit_route_stops failed, table doesn't exist yet.`);
                return { hasDependency: false };
            }
            throw error;
        }
    },
    getUpcomingBySalesAndDate: async (salesPersonId, visitDate) => {
        const query = `
            SELECT 
                v.id, v.storeId, v.purpose,
                s.name as storeName, s.address, s.lat, s.lng
            FROM visits v
            JOIN stores s ON v.storeId = s.id
            WHERE v.salesPersonId = ? 
              AND v.visitDate = ? 
              AND v.status = 'Akan Datang'
        `;
        const [rows] = await pool.query(query, [salesPersonId, visitDate]);

        return rows.map(row => ({
            id: row.id,
            storeId: row.storeId,
            purpose: row.purpose,
            storeName: row.storeName,
            address: row.address,
            location: { lat: row.lat, lng: row.lng }
        }));
    }
};

module.exports = Visit;
