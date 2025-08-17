
const Vehicle = require('../models/vehicleModel');
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const Route = require('../models/routeModel');
const { calculateSavingsMatrixRoutes } = require('../services/routingService');

const createPlan = async (req, res) => {
    const { deliveryDate, vehicleId, driverId } = req.body;

    if (!deliveryDate || !vehicleId || !driverId) {
        return res.status(400).json({ message: "Harap pilih tanggal, armada, dan pengemudi." });
    }

    try {
        const vehicle = await Vehicle.getById(vehicleId);
        const driver = await User.getById(driverId);
        
        if (!vehicle || !driver) {
            return res.status(404).json({ message: "Armada atau pengemudi tidak valid." });
        }
        
        // Hapus semua rencana yang belum dimulai untuk armada & tanggal ini sebelum membuat yang baru.
        // Ini memungkinkan perencanaan ulang yang aman di tengah hari.
        await Route.deletePendingPlansForVehicle(vehicleId, deliveryDate);
        
        const routableOrders = await Order.findRoutableOrders({ deliveryDate, vehicleRegion: vehicle.region, vehicleId });

        if (routableOrders.length === 0) {
            return res.status(404).json({ message: "Tidak ada pesanan 'Pending' yang tersisa untuk dijadwalkan ulang hari ini." });
        }

        // 1. Group orders by store to treat multiple orders to the same store as a single stop for routing
        const storeStops = routableOrders.reduce((acc, order) => {
            if (!acc[order.storeId]) {
                acc[order.storeId] = {
                    storeId: order.storeId,
                    storeName: order.storeName,
                    address: order.address,
                    location: order.location,
                    totalDemand: 0,
                    orderIds: [],
                    priority: false,
                };
            }
            acc[order.storeId].totalDemand += order.demand;
            acc[order.storeId].orderIds.push(order.id);
            if (order.priority) {
                acc[order.storeId].priority = true;
            }
            return acc;
        }, {});

        // 2. Create nodes for the routing algorithm from the grouped stores
        const nodes = Object.values(storeStops).map(store => ({
            id: store.storeId, // The routing algorithm uses the storeId as the unique node identifier
            location: store.location,
            demand: store.totalDemand,
            priority: store.priority,
        }));
        
        const depotLocation = { lat: -7.8664161, lng: 110.1486773 }; // PDAM Tirta Binangun
        // The algorithm now returns trips of storeIds, not orderIds
        const calculatedTrips = calculateSavingsMatrixRoutes(nodes, depotLocation, vehicle.capacity);

        if (calculatedTrips.length === 0 && nodes.length > 0) {
             return res.status(500).json({ message: "Gagal menghasilkan rute. Pastikan ada pesanan yang valid." });
        }
        
        // --- Prioritization Logic ---
        const priorityStoreIds = new Set(nodes.filter(n => n.priority).map(n => n.id));
        const sortedTrips = calculatedTrips.sort((tripA, tripB) => {
            const hasPriorityA = tripA.some(storeId => priorityStoreIds.has(storeId));
            const hasPriorityB = tripB.some(storeId => priorityStoreIds.has(storeId));
            if (hasPriorityA && !hasPriorityB) return -1;
            if (!hasPriorityA && hasPriorityB) return 1;
            return 0;
        });
        
        const newRoutes = [];
        let totalRoutedOrders = 0;

        for (const tripStoreIds of sortedTrips) {
            const stopsForThisTrip = [];
            // Iterate through storeIds in the optimized trip sequence
            for (const storeId of tripStoreIds) {
                const storeData = storeStops[storeId];
                // Find all original orders associated with this store stop
                const ordersForThisStore = routableOrders.filter(o => storeData.orderIds.includes(o.id));
                
                ordersForThisStore.forEach(order => {
                    stopsForThisTrip.push({
                        orderId: order.id,
                        storeId: order.storeId,
                        storeName: order.storeName,
                        address: order.address,
                        location: order.location
                    });
                });
            }


            if (stopsForThisTrip.length > 0) {
                totalRoutedOrders += stopsForThisTrip.length;
                const newRoutePlan = {
                    driverId,
                    vehicleId,
                    date: deliveryDate,
                    stops: stopsForThisTrip,
                    region: vehicle.region
                };
                const createdRoute = await Route.createPlan(newRoutePlan);
                newRoutes.push(createdRoute);
            }
        }
        
        const oversizedTrips = sortedTrips.filter(trip => {
            const tripLoad = trip.reduce((sum, storeId) => {
                const node = nodes.find(n => n.id === storeId);
                return sum + (node ? node.demand : 0);
            }, 0);
            return tripLoad > vehicle.capacity;
        });

        let message = `Berhasil membuat ${newRoutes.length} perjalanan baru untuk ${driver.name}, menjadwalkan ${totalRoutedOrders} pesanan.`;
        if (oversizedTrips.length > 0) {
             message += ` PERINGATAN: ${oversizedTrips.length} perjalanan melebihi kapasitas. Silakan periksa di menu Pantau Muatan.`;
        }


        res.status(201).json({ success: true, message, routes: newRoutes });
        
    } catch (error) {
        console.error('Error creating route plan:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server saat membuat rencana rute.' });
    }
};

const getRoutePlans = async (req, res) => {
    try {
        const { user } = req;
        let filters = { ...req.query };

        // Security: Drivers can only see their own data. Admins see everything based on query.
        if (user.role === 'Driver') {
            filters.driverId = user.id;
        } else if (user.role !== 'Admin') {
            // Other roles (like Sales) cannot see delivery routes.
            return res.json([]);
        }
        
        const plans = await Route.getAll(filters);
        res.json(plans);
    } catch (error) {
        console.error('Error getting route plans:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server saat mengambil riwayat perjalanan.' });
    }
};

const getRoutePlanById = async (req, res) => {
    try {
        const plan = await Route.getById(req.params.id);
        if (plan) {
            // Security check for non-admins
            if (req.user.role === 'Driver' && req.user.id !== plan.driverId) {
                return res.status(403).json({ message: 'Akses ditolak.' });
            }
            res.json(plan);
        } else {
            res.status(404).json({ message: 'Rencana rute tidak ditemukan.' });
        }
    } catch (error) {
        console.error(`Error getting route plan ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const updateStopStatus = async (req, res) => {
    const { id: stopId } = req.params;
    const { status, proofImage, failureReason } = req.body;
    const { user } = req; // Logged-in user

    if (!status || (status === 'Failed' && !failureReason)) {
        return res.status(400).json({ message: 'Status (dan alasan jika Gagal) wajib diisi.' });
    }

    try {
        const result = await Route.updateStopStatus(stopId, { status, proofOfDeliveryImage: proofImage, failureReason }, user);
        if (result) {
            res.json({ message: 'Status berhasil diperbarui.' });
        } else {
            res.status(404).json({ message: 'Pemberhentian tidak ditemukan atau Anda tidak memiliki izin untuk memperbaruinya.' });
        }
    } catch (error) {
        console.error(`Error updating stop status ${stopId}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server saat memperbarui status.' });
    }
};

const deleteRoutePlan = async (req, res) => {
    const { id: routeId } = req.params;
    try {
        const success = await Route.deletePlan(routeId);
        if (success) {
            res.json({ message: 'Rencana perjalanan berhasil dihapus dan pesanan dikembalikan.' });
        } else {
            res.status(404).json({ message: 'Rencana perjalanan tidak ditemukan.' });
        }
    } catch (error) {
        console.error(`Error deleting route plan ${routeId}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server saat menghapus rencana.' });
    }
};

const moveOrder = async (req, res) => {
    const { orderId, newVehicleId } = req.body;
    if (!orderId) {
        return res.status(400).json({ message: "ID Pesanan wajib diisi." });
    }
    try {
        await Route.moveOrder(orderId, newVehicleId);
        res.json({ message: 'Pesanan berhasil dipindahkan.' });
    } catch (error) {
        console.error(`Error moving order ${orderId}:`, error);
        res.status(500).json({ message: error.message || 'Gagal memindahkan pesanan.' });
    }
};


module.exports = {
    createPlan,
    getRoutePlans,
    getRoutePlanById,
    updateStopStatus,
    deleteRoutePlan,
    moveOrder,
};