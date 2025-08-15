
import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { getVehicles } from '../../services/vehicleApiService';
import { getDeliveryRoutes, moveOrder } from '../../services/routeApiService';
import { getUsers } from '../../services/userApiService';
import { getOrders } from '../../services/orderApiService';
import { getProducts } from '../../services/productApiService';
import { getStores } from '../../services/storeApiService';
import { VehicleStatus, Vehicle, RoutePlan, User, Order, Product, OrderStatus, Store } from '../../types';
import { Modal } from '../ui/Modal';
import { ICONS } from '../../constants';

const VehicleStatusBadge: React.FC<{ status: VehicleStatus }> = ({ status }) => {
    const statusInfo = useMemo(() => {
        switch (status) {
            case VehicleStatus.IDLE: return { text: 'Idle', className: 'bg-green-100 text-green-800' };
            case VehicleStatus.DELIVERING: return { text: 'Sedang Mengirim', className: 'bg-blue-100 text-blue-800' };
            case VehicleStatus.REPAIR: return { text: 'Dalam Perbaikan', className: 'bg-yellow-100 text-yellow-800' };
            default: return { text: status, className: 'bg-gray-100 text-gray-800' };
        }
    }, [status]);
    return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusInfo.className}`}>{statusInfo.text}</span>;
};

const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
    const statusInfo = useMemo(() => {
        switch (status) {
            case OrderStatus.PENDING: return { text: 'Pending', className: 'bg-yellow-100 text-yellow-800' };
            case OrderStatus.ROUTED: return { text: 'Routed', className: 'bg-cyan-100 text-cyan-800' };
            case OrderStatus.DELIVERING: return { text: 'Delivering', className: 'bg-indigo-100 text-indigo-800' };
            case OrderStatus.FAILED: return { text: 'Failed', className: 'bg-red-100 text-red-800' };
            case OrderStatus.DELIVERED: return { text: 'Delivered', className: 'bg-green-100 text-green-800' };
            default: return { text: status, className: 'bg-gray-100 text-gray-800' };
        }
    }, [status]);
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.className}`}>{statusInfo.text}</span>;
};

const MoveOrderModal: React.FC<{
    order: Order | null;
    onClose: () => void;
    vehicles: Vehicle[];
    stores: Store[];
    mutation: any;
}> = ({ order, onClose, vehicles, stores, mutation }) => {
    const [targetVehicleId, setTargetVehicleId] = useState<string | null>(null);

    useEffect(() => {
        if(order) {
            setTargetVehicleId(order.assignedVehicleId || null);
        }
    }, [order]);

    if (!order) return null;
    
    // Correctly find available vehicles based on region, not existing routes
    const orderStore = stores.find(s => s.id === order.storeId);
    const orderRegion = orderStore?.region;
    const availableVehiclesForMove = vehicles.filter(v => v.region === orderRegion);

    const handleSubmit = () => {
        if (targetVehicleId === order.assignedVehicleId) {
            onClose();
            return;
        }
        mutation.mutate({ orderId: order.id, newVehicleId: targetVehicleId });
    };

    return (
        <Modal title={`Pindahkan Pesanan ${order.id.slice(0, 6).toUpperCase()}`} isOpen={!!order} onClose={onClose}>
            <div className="space-y-4">
                <p>Pindahkan pesanan untuk toko <strong>{order.storeName}</strong> ke armada lain di wilayah <strong>{orderRegion}</strong>.</p>
                <div>
                    <label htmlFor="targetVehicle" className="block text-sm font-medium text-gray-700">Pilih Armada Tujuan</label>
                    <select
                        id="targetVehicle"
                        value={targetVehicleId === null ? 'pending' : targetVehicleId}
                        onChange={(e) => setTargetVehicleId(e.target.value === 'pending' ? null : e.target.value)}
                        className="w-full p-2 border rounded mt-1 bg-white"
                    >
                        <option value="pending">-- Batalkan Penugasan (Jadikan Pending) --</option>
                        {availableVehiclesForMove.map((v: Vehicle) => (
                            <option key={v.id} value={v.id}>
                                {v.plateNumber} ({v.model})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end pt-4 gap-2">
                    <button onClick={onClose} className="bg-gray-200 font-bold py-2 px-4 rounded-lg">Batal</button>
                    <button
                        onClick={handleSubmit}
                        disabled={mutation.isPending}
                        className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400"
                    >
                        {mutation.isPending ? 'Memindahkan...' : 'Simpan'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};


export const FleetManagement: React.FC = () => {
    const today = new Date().toISOString().split('T')[0];
    const queryClient = useQueryClient();
    const [orderToMove, setOrderToMove] = useState<Order | null>(null);

    const { data: vehicles = [], isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({ queryKey: ['vehicles'], queryFn: getVehicles });
    const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({ queryKey: ['users'], queryFn: getUsers });
    const { data: routes = [], isLoading: isLoadingRoutes } = useQuery<RoutePlan[]>({ queryKey: ['deliveryRoutes', { date: today }], queryFn: () => getDeliveryRoutes({ date: today }) });
    const { data: orders = [], isLoading: isLoadingOrders } = useQuery<Order[]>({ queryKey: ['orders'], queryFn: getOrders });
    const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({ queryKey: ['products'], queryFn: getProducts });
    const { data: stores = [], isLoading: isLoadingStores } = useQuery<Store[]>({ queryKey: ['stores'], queryFn: getStores });

    const moveOrderMutation = useMutation({
        mutationFn: moveOrder,
        onSuccess: () => {
            alert('Pesanan berhasil dipindahkan.');
            queryClient.invalidateQueries({ queryKey: ['deliveryRoutes'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            setOrderToMove(null);
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || 'Gagal memindahkan pesanan.');
        }
    });
    
    const fleetData = useMemo(() => {
        if (!vehicles.length || !products.length || !orders.length) return [];

        const allOrdersWithLoad = orders.map(order => {
            const load = order.items.reduce((itemSum, item) => {
                const product = products.find(p => p.id === item.productId);
                return itemSum + (item.quantity * (product?.capacityUnit || 0));
            }, 0);
            return { ...order, load: Math.round(load * 10) / 10 };
        });

        return vehicles.map(vehicle => {
            const vehicleRoutesToday = routes.filter(r => r.vehicleId === vehicle.id);
            const driver = vehicleRoutesToday.length > 0 ? users.find(u => u.id === vehicleRoutesToday[0].driverId) : null;
            
            const routedOrderIds = new Set(vehicleRoutesToday.flatMap(r => r.stops.map(s => s.orderId)));

            // Group 1: Officially routed trips
            const trips = vehicleRoutesToday.map((route, index) => {
                const ordersInTrip = allOrdersWithLoad
                    .filter(o => routedOrderIds.has(o.id) && route.stops.some(s => s.orderId === o.id))
                    .sort((a, b) => {
                        const indexA = route.stops.findIndex(s => s.orderId === a.id);
                        const indexB = route.stops.findIndex(s => s.orderId === b.id);
                        return indexA - indexB;
                    });
                const tripLoad = ordersInTrip.reduce((sum, order) => sum + order.load, 0);
                return { id: route.id, name: `Perjalanan ${index + 1}`, tripLoad: Math.round(tripLoad * 10) / 10, stops: ordersInTrip };
            });

            // Group 2: Pre-assigned pending orders
            const pendingOrders = allOrdersWithLoad.filter(order =>
                order.status === OrderStatus.PENDING &&
                order.assignedVehicleId === vehicle.id &&
                !routedOrderIds.has(order.id)
            );
            const pendingLoad = pendingOrders.reduce((sum, order) => sum + order.load, 0);
            
            return {
                ...vehicle,
                driver,
                trips,
                pendingOrders,
                pendingLoad: Math.round(pendingLoad * 10) / 10,
            };
        });
    }, [vehicles, routes, users, orders, products]);


    const isLoading = isLoadingVehicles || isLoadingUsers || isLoadingRoutes || isLoadingOrders || isLoadingProducts || isLoadingStores;

    if (isLoading) {
        return <div className="p-8">Memuat data armada...</div>;
    }

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-3xl font-bold text-brand-dark">Manajemen Muatan & Armada</h1>
            
            {fleetData.length === 0 && (
                <Card>
                    <p className="text-center py-10 text-gray-500">Tidak ada data armada yang tersedia.</p>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fleetData.map(vehicle => (
                    <Card key={vehicle.id} className="flex flex-col space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="font-bold text-lg text-brand-dark">{vehicle.plateNumber}</h2>
                                <p className="text-sm text-gray-500">{vehicle.model} - {vehicle.driver?.name || 'Belum ada pengemudi'}</p>
                            </div>
                            <VehicleStatusBadge status={vehicle.status} />
                        </div>
                       
                        {vehicle.trips.length > 0 && (
                            <div className="flex-grow flex flex-col space-y-6">
                                {vehicle.trips.map(trip => (
                                    <div key={trip.id} className="border-t pt-4">
                                        <h3 className="font-bold text-base text-brand-dark mb-2">{trip.name}</h3>
                                        <div className="mb-4">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-semibold">Muatan Perjalanan</span>
                                                <span>{trip.tripLoad} / {vehicle.capacity} unit</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-4 mt-1 relative">
                                                <div 
                                                    className={`h-4 rounded-full ${trip.tripLoad > vehicle.capacity ? 'bg-red-500' : 'bg-brand-primary'}`} 
                                                    style={{ width: `${Math.min((trip.tripLoad / vehicle.capacity) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                            {trip.tripLoad > vehicle.capacity && (
                                                <p className="text-red-500 text-xs text-right mt-1 font-semibold">Kapasitas terlampaui!</p>
                                            )}
                                        </div>
                                        <div className="space-y-2 max-h-52 overflow-y-auto pr-2">
                                            {trip.stops.map(order => (
                                                <div key={order.id} className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-lg">
                                                    <div>
                                                        <p className="font-semibold text-gray-800">{order.storeName}</p>
                                                        <p className="text-xs text-gray-500">ID: {order.id.slice(0, 6)} | Unit: {order.load}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                       <OrderStatusBadge status={order.status} />
                                                       <button onClick={() => setOrderToMove(order)} className="text-xs text-blue-600 hover:underline font-semibold">Pindahkan</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {vehicle.pendingOrders.length > 0 && (
                            <div className="border-t pt-4">
                                <h3 className="font-bold text-base text-yellow-700 bg-yellow-100 p-2 rounded-md mb-2">Pesanan Pending (Pra-Penugasan)</h3>
                                <div className="my-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-semibold">Total Muatan Pending</span>
                                        <span>{vehicle.pendingLoad} / {vehicle.capacity} unit</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-4 mt-1 relative">
                                        <div 
                                            className={`h-4 rounded-full ${vehicle.pendingLoad > vehicle.capacity ? 'bg-red-500' : 'bg-brand-secondary'}`} 
                                            style={{ width: `${Math.min((vehicle.pendingLoad / vehicle.capacity) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                    {vehicle.pendingLoad > vehicle.capacity && (
                                        <p className="text-red-500 text-xs text-right mt-1 font-semibold">Kapasitas terlampaui!</p>
                                    )}
                                </div>
                                <div className="space-y-2 max-h-52 overflow-y-auto pr-2">
                                    {vehicle.pendingOrders.map(order => (
                                        <div key={order.id} className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <p className="font-semibold text-gray-800">{order.storeName}</p>
                                                <p className="text-xs text-gray-500">ID: {order.id.slice(0, 6)} | Unit: {order.load}</p>
                                            </div>
                                             <div className="flex items-center gap-3">
                                               <OrderStatusBadge status={order.status} />
                                               <button onClick={() => setOrderToMove(order)} className="text-xs text-blue-600 hover:underline font-semibold">Pindahkan</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {vehicle.trips.length === 0 && vehicle.pendingOrders.length === 0 && (
                             <div className="text-center border-t pt-6 mt-auto flex-grow flex items-center justify-center">
                                <p className="text-sm text-gray-500">
                                    {vehicle.status === VehicleStatus.IDLE ? "Tidak ada rute atau pesanan yang ditugaskan." : "Armada dalam perbaikan."}
                                </p>
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            <MoveOrderModal
                order={orderToMove}
                onClose={() => setOrderToMove(null)}
                vehicles={vehicles}
                stores={stores}
                mutation={moveOrderMutation}
            />
        </div>
    );
};
