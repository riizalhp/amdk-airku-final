
const pool = require('../config/db');
const { randomUUID } = require('crypto');

// Helper to calculate distance between two lat/lng points in KM
const haversineDistance = (coords1, coords2) => {
    function toRad(x) {
        return x * Math.PI / 180;
    }
    if (!coords1 || !coords2) return 0;

    const lat1 = coords1.lat;
    const lon1 = coords1.lng;
    const lat2 = coords2.lat;
    const lon2 = coords2.lng;

    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in km
};

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
                // Calculate distances before inserting
                for (let i = 0; i < stops.length - 1; i++) {
                    const currentStop = stops[i];
                    const nextStop = stops[i + 1];
                    if (currentStop.location && nextStop.location) {
                        const distance = haversineDistance(currentStop.location, nextStop.location);
                        stops[i].distanceToNext = parseFloat(distance.toFixed(2));
                    } else {
                        stops[i].distanceToNext = null;
                    }
                }
                // Last stop has no next stop
                if (stops.length > 0) {
                    stops[stops.length - 1].distanceToNext = null;
                }

                const stopsQuery = `
                    INSERT INTO sales_visit_route_stops (id, planId, visitId, storeId, storeName, address, purpose, sequence, distance_to_next_km)
                    VALUES ?`;
                const stopsData = stops.map((stop, index) => [
                    randomUUID(),
                    planId,
                    stop.visitId,
                    stop.storeId,
                    stop.storeName,
                    stop.address,
                    stop.purpose,
                    index + 1,
                    stop.distanceToNext
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
        const depotLocation = { lat: -7.8664161, lng: 110.1486773 }; // PDAM

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
                sequence: stop.sequence,
                location: { lat: stop.lat, lng: stop.lng },
                status: stop.status || 'Akan Datang',
                notes: stop.notes,
                proofOfVisitImage: stop.proofOfVisitImage,
                distanceToNext: stop.distance_to_next_km, // Read from DB
            });
            return acc;
        }, {});

        return plans.map(plan => {
            const planStops = stopsByPlanId[plan.id] || [];
            let distanceFromDepot = null;
            if (planStops.length > 0 && planStops[0].location) {
                const distance = haversineDistance(depotLocation, planStops[0].location);
                distanceFromDepot = parseFloat(distance.toFixed(2));
            }

            return {
                ...plan,
                stops: planStops,
                distanceFromDepot: distanceFromDepot, // Jarak dari gudang ke titik pertama
            };
        });
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