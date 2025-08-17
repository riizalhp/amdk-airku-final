
const pool = require('../config/db');
const { randomUUID } = require('crypto');

const createPlan = async (plan) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const { driverId, vehicleId, date, stops, region } = plan;
      const planId = randomUUID();

      // Insert into route_plans table
      const routePlanQuery = `
        INSERT INTO route_plans (id, driverId, vehicleId, date, region) 
        VALUES (?, ?, ?, ?, ?)`;
      await connection.query(routePlanQuery, [planId, driverId, vehicleId, date, region]);
      
      if (stops && stops.length > 0) {
        // Prepare bulk insert for route_stops table, now including lat/lng
        const routeStopsQuery = `
          INSERT INTO route_stops (id, routePlanId, orderId, storeId, storeName, address, lat, lng, status, sequence)
          VALUES ?`;
        const routeStopsData = stops.map((stop, index) => [
          randomUUID(),
          planId,
          stop.orderId,
          stop.storeId,
          stop.storeName,
          stop.address,
          stop.location.lat,
          stop.location.lng,
          'Pending', // Default status for a new stop
          index + 1  // Sequence number
        ]);
        await connection.query(routeStopsQuery, [routeStopsData]);

        // Update the status of the orders included in this new route
        const orderIds = stops.map(stop => stop.orderId);
        const placeholders = orderIds.map(() => '?').join(',');
        const updateOrdersQuery = `
          UPDATE orders SET status = 'Routed', assignedVehicleId = ? 
          WHERE id IN (${placeholders})`;
        await connection.query(updateOrdersQuery, [vehicleId, ...orderIds]);
      }

      await connection.commit();
      
      // Return the created plan object
      return { id: planId, ...plan };

    } catch (error) {
      await connection.rollback();
      console.error("Error in transaction, rolled back.", error);
      throw error;
    } finally {
      connection.release();
    }
};

const deletePendingPlansForVehicle = async (vehicleId, date) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        // 1. Find all plans for this vehicle on this date
        const [plans] = await connection.query(
            'SELECT id FROM route_plans WHERE vehicleId = ? AND date = ?',
            [vehicleId, date]
        );

        if (plans.length === 0) {
            await connection.commit();
            return; // Nothing to do
        }

        const planIds = plans.map(p => p.id);
        
        // 2. Find which of these plans have ONLY pending stops (i.e., are un-started)
        const [nonPendingCounts] = await connection.query(`
            SELECT routePlanId
            FROM route_stops
            WHERE routePlanId IN (?) AND status != 'Pending'
            GROUP BY routePlanId
        `, [planIds]);
        
        const plansWithProgress = new Set(nonPendingCounts.map(row => row.routePlanId));
        const pendingPlanIds = planIds.filter(id => !plansWithProgress.has(id));

        if (pendingPlanIds.length > 0) {
            // 3. For the un-started plans, get all their order IDs
            const [ordersToReset] = await connection.query(
                `SELECT orderId FROM route_stops WHERE routePlanId IN (?)`,
                [pendingPlanIds]
            );
            
            const orderIdsToReset = ordersToReset.map(o => o.orderId);

            // 4. Delete the stops and the plans
            await connection.query(`DELETE FROM route_stops WHERE routePlanId IN (?)`, [pendingPlanIds]);
            await connection.query(`DELETE FROM route_plans WHERE id IN (?)`, [pendingPlanIds]);
            
            // 5. Reset the orders to Pending and unassign them
            if (orderIdsToReset.length > 0) {
                await connection.query(
                    `UPDATE orders SET status = 'Pending', assignedVehicleId = NULL WHERE id IN (?)`,
                    [orderIdsToReset]
                );
            }
        }
        
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        console.error("Error deleting pending plans:", error);
        throw error;
    } finally {
        connection.release();
    }
};

const getAll = async (filters = {}) => {
      let query = 'SELECT * FROM route_plans';
      const params = [];

      if (filters.date || filters.driverId || filters.vehicleId) {
          query += ' WHERE ';
          const conditions = [];
          if(filters.date) {
              conditions.push('date = ?');
              params.push(filters.date);
          }
          if(filters.driverId) {
              conditions.push('driverId = ?');
              params.push(filters.driverId);
          }
          if(filters.vehicleId) {
              conditions.push('vehicleId = ?');
              params.push(filters.vehicleId);
          }
          query += conditions.join(' AND ');
      }
      
      query += ' ORDER BY date DESC';

      const [plans] = await pool.query(query, params);
      if (plans.length === 0) return [];

      const planIds = plans.map(p => p.id);
      const placeholders = planIds.map(() => '?').join(',');

      const stopsQuery = `
        SELECT rs.*, s.lat, s.lng 
        FROM route_stops rs
        LEFT JOIN stores s ON rs.storeId = s.id
        WHERE rs.routePlanId IN (${placeholders}) 
        ORDER BY rs.sequence ASC
      `;
      const [stops] = await pool.query(stopsQuery, planIds);
      
      const stopsByPlanId = stops.reduce((acc, stop) => {
          if (!acc[stop.routePlanId]) acc[stop.routePlanId] = [];
          const { routePlanId, lat, lng, ...restOfStop } = stop;
          acc[stop.routePlanId].push({ 
              ...restOfStop,
              location: { lat, lng }
          });
          return acc;
      }, {});

      return plans.map(plan => ({
          ...plan,
          stops: stopsByPlanId[plan.id] || [],
      }));
};

const getById = async (id) => {
      const planQuery = 'SELECT * FROM route_plans WHERE id = ?';
      const [plans] = await pool.query(planQuery, [id]);
      if (plans.length === 0) return null;

      const plan = plans[0];
      const stopsQuery = `
        SELECT rs.*, s.lat, s.lng 
        FROM route_stops rs 
        LEFT JOIN stores s ON rs.storeId = s.id
        WHERE rs.routePlanId = ? 
        ORDER BY rs.sequence ASC
      `;
      const [stops] = await pool.query(stopsQuery, [id]);

      const { ...restOfPlan } = plan;
      return {
          ...restOfPlan,
          stops: stops.map(stop => {
              const { routePlanId, lat, lng, ...restOfStop } = stop;
              return { 
                  ...restOfStop,
                  location: { lat, lng }
              };
          })
      };
};

const updateStopStatus = async (stopId, data, user) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const [stopRows] = await connection.query(`
            SELECT rs.orderId, rp.driverId 
            FROM route_stops rs 
            JOIN route_plans rp ON rs.routePlanId = rp.id
            WHERE rs.id = ?
        `, [stopId]);
        
        if (stopRows.length === 0) {
            await connection.rollback();
            return null; 
        }
        if (user.role === 'Driver' && stopRows[0].driverId !== user.id) {
            await connection.rollback();
            return null; // Security check
        }
        
        const { orderId } = stopRows[0];

        if (data.status === 'Completed') {
            await connection.query(
                'UPDATE route_stops SET status = ?, proofOfDeliveryImage = ?, failureReason = ? WHERE id = ?',
                [data.status, data.proofOfDeliveryImage || null, null, stopId]
            );
            
            const [items] = await connection.query('SELECT productId, quantity FROM order_items WHERE orderId = ?', [orderId]);
            await connection.query('UPDATE orders SET status = ?, priority = ? WHERE id = ?', ['Delivered', false, orderId]);
            for (const item of items) {
                // Finalize stock: decrease physical and reserved stock
                await connection.query('UPDATE products SET stock = stock - ?, reservedStock = GREATEST(0, reservedStock - ?) WHERE id = ?', [item.quantity, item.quantity, item.productId]);
            }
        } else if (data.status === 'Failed') {
            // 1. Mark the stop as 'Failed' for historical record.
            await connection.query(
                'UPDATE route_stops SET status = ?, proofOfDeliveryImage = ?, failureReason = ? WHERE id = ?',
                ['Failed', data.proofOfDeliveryImage || null, data.failureReason, stopId]
            );

            // 2. Reset the order to be re-planned for the next day.
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            
            // Explicitly set status to 'Pending', update date, and set priority.
            // The assignedVehicleId is intentionally NOT updated to keep it with the same fleet.
            await connection.query(
                'UPDATE orders SET status = ?, desiredDeliveryDate = ?, priority = ? WHERE id = ?',
                ['Pending', tomorrowStr, true, orderId]
            );
        }

        await connection.commit();
        return { success: true };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const deletePlan = async (planId) => {
     const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const [stops] = await connection.query('SELECT orderId FROM route_stops WHERE routePlanId = ?', [planId]);
        if (stops.length > 0) {
            const orderIds = stops.map(s => s.orderId);
            const placeholders = orderIds.map(() => '?').join(',');
            await connection.query(`UPDATE orders SET status = 'Pending', assignedVehicleId = NULL WHERE id IN (${placeholders})`, orderIds);
        }

        await connection.query('DELETE FROM route_stops WHERE routePlanId = ?', [planId]);
        const [result] = await connection.query('DELETE FROM route_plans WHERE id = ?', [planId]);

        await connection.commit();
        return result.affectedRows > 0;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const moveOrder = async (orderId, newVehicleId) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [orderRows] = await connection.query('SELECT storeId FROM orders WHERE id = ?', [orderId]);
      if (orderRows.length === 0) throw new Error('Pesanan tidak ditemukan.');
      const { storeId } = orderRows[0];

      // Determine the correct date context for the move operation.
      // If the order is in a plan, use that plan's date. Otherwise, default to today.
      const [currentStopRows] = await connection.query(`
        SELECT rp.date 
        FROM route_stops rs
        JOIN route_plans rp ON rs.routePlanId = rp.id
        WHERE rs.orderId = ?
      `, [orderId]);

      const planDate = currentStopRows.length > 0 ? currentStopRows[0].date : new Date().toISOString().split('T')[0];
      
      // Hapus pesanan dari pemberhentian rute saat ini, jika ada
      await connection.query('DELETE FROM route_stops WHERE orderId = ?', [orderId]);

      if (newVehicleId === null) {
        // Jika dipindahkan ke pending, batalkan penugasan kendaraan dan atur status ke Pending
        await connection.query(`UPDATE orders SET status = 'Pending', assignedVehicleId = NULL WHERE id = ?`, [orderId]);
      } else {
        // Jika dipindahkan ke armada lain, lakukan validasi
        const [storeRows] = await connection.query('SELECT region FROM stores WHERE id = ?', [storeId]);
        const [vehicleRows] = await connection.query('SELECT region FROM vehicles WHERE id = ?', [newVehicleId]);
        if (storeRows.length === 0 || vehicleRows.length === 0) throw new Error('Toko atau armada tidak valid.');
        if (storeRows[0].region !== vehicleRows[0].region) {
            throw new Error(`Tidak dapat memindahkan pesanan. Toko berada di wilayah '${storeRows[0].region}' sedangkan armada di wilayah '${vehicleRows[0].region}'.`);
        }

        // Periksa apakah sudah ada rencana rute untuk armada baru pada tanggal yang benar
        const [newPlanRows] = await connection.query('SELECT id FROM route_plans WHERE vehicleId = ? AND date = ? ORDER BY id LIMIT 1', [newVehicleId, planDate]);
        
        if (newPlanRows.length > 0) {
            // Rencana ADA: Tambahkan pesanan sebagai pemberhentian baru ke rencana yang ada
            const newPlanId = newPlanRows[0].id;
            const [storeDetails] = await connection.query(`SELECT name as storeName, address, lat, lng FROM stores WHERE id = ?`, [storeId]);
            const { storeName, address, lat, lng } = storeDetails[0];

            const [maxSeqRows] = await connection.query('SELECT MAX(sequence) as maxSeq FROM route_stops WHERE routePlanId = ?', [newPlanId]);
            const newSequence = (maxSeqRows[0].maxSeq || 0) + 1;

            const newStopId = randomUUID();
            const stopInsertQuery = 'INSERT INTO route_stops (id, routePlanId, orderId, storeId, storeName, address, lat, lng, status, sequence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            await connection.query(stopInsertQuery, [newStopId, newPlanId, orderId, storeId, storeName, address, lat, lng, 'Pending', newSequence]);
            
            // Perbarui status pesanan menjadi 'Routed'
            await connection.query(`UPDATE orders SET status = 'Routed', assignedVehicleId = ? WHERE id = ?`, [newVehicleId, orderId]);
        } else {
            // Rencana TIDAK ADA: Cukup tugaskan armada dan pertahankan status 'Pending' (pra-penugasan)
            await connection.query(`UPDATE orders SET status = 'Pending', assignedVehicleId = ? WHERE id = ?`, [newVehicleId, orderId]);
        }
      }

      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
};

module.exports = {
  createPlan,
  deletePendingPlansForVehicle,
  getAll,
  getById,
  updateStopStatus,
  deletePlan,
  moveOrder,
};