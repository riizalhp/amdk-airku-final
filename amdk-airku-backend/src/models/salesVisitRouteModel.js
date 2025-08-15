
const pool = require('../config/db');
const { randomUUID } = require('crypto');

const SalesVisitRouteModel = {
    create: async (planData) => {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const { salesPersonId, date, stops } = planData;
            const planId = randomUUID();

            const planQuery = 'INSERT INTO sales_visit_route_plans (id, salesPersonId, date) VALUES (?, ?, ?)';
            await connection.query(planQuery, [planId, salesPersonId, date]);

            if (stops && stops.length > 0) {
                const stopsQuery = `
                    INSERT INTO sales_visit_route_stops (id, planId, visitId, storeId, storeName, address, purpose, sequence)
                    VALUES ?`;
                const stopsData = stops.map((stop, index) => [
                    randomUUID(),
                    planId,
                    stop.visitId,
                    stop.storeId,
                    stop.storeName,
                    stop.address,
                    stop.purpose,
                    index + 1
                ]);
                await connection.query(stopsQuery, [stopsData]);
            }
            
            await connection.commit();
            return { id: planId, ...planData };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },
    
    // Helper to structure the data
    _structurePlans: async (plans) => {
        if (plans.length === 0) return [];
        const planIds = plans.map(p => p.id);
        const placeholders = planIds.map(() => '?').join(',');

        const stopsQuery = `
            SELECT 
                svrs.*, 
                s.lat, 
                s.lng,
                v.status,
                v.notes,
                v.proofOfVisitImage
            FROM sales_visit_route_stops svrs
            JOIN stores s ON svrs.storeId = s.id
            LEFT JOIN visits v ON svrs.visitId = v.id
            WHERE svrs.planId IN (${placeholders}) 
            ORDER BY svrs.sequence ASC`;
        const [stops] = await pool.query(stopsQuery, planIds);

        const stopsByPlanId = stops.reduce((acc, stop) => {
            if (!acc[stop.planId]) acc[stop.planId] = [];
            acc[stop.planId].push({
                visitId: stop.visitId,
                storeId: stop.storeId,
                storeName: stop.storeName,
                address: stop.address,
                purpose: stop.purpose,
                location: { lat: stop.lat, lng: stop.lng },
                status: stop.status || 'Akan Datang', // Default status
                notes: stop.notes,
                proofOfVisitImage: stop.proofOfVisitImage,
            });
            return acc;
        }, {});

        return plans.map(plan => ({
            ...plan,
            stops: stopsByPlanId[plan.id] || [],
        }));
    },
    
    getAll: async () => {
        const [plans] = await pool.query('SELECT * FROM sales_visit_route_plans ORDER BY date DESC');
        return await SalesVisitRouteModel._structurePlans(plans);
    },

    getBySalesPersonId: async (salesPersonId) => {
        const [plans] = await pool.query('SELECT * FROM sales_visit_route_plans WHERE salesPersonId = ? ORDER BY date DESC', [salesPersonId]);
        return await SalesVisitRouteModel._structurePlans(plans);
    },

    getById: async (id) => {
        const [plans] = await pool.query('SELECT * FROM sales_visit_route_plans WHERE id = ?', [id]);
        if (plans.length === 0) return null;
        const structured = await SalesVisitRouteModel._structurePlans(plans);
        return structured[0];
    },

    delete: async (id) => {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            await connection.query('DELETE FROM sales_visit_route_stops WHERE planId = ?', [id]);
            const [result] = await connection.query('DELETE FROM sales_visit_route_plans WHERE id = ?', [id]);
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },
};

module.exports = SalesVisitRouteModel;