

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { RoutePlan, User, Vehicle, RouteStop, SalesVisitRoutePlan, SalesVisitStop, VisitStatus } from '../../types';
import { getDeliveryRoutes } from '../../services/routeApiService';
import { getSalesRoutes } from '../../services/routeApiService';
import { getUsers } from '../../services/userApiService';
import { getVehicles } from '../../services/vehicleApiService';
import { Modal } from '../ui/Modal';
import { ICONS } from '../../constants';

const getDeliveryStatusClass = (status: RouteStop['status']) => {
    switch (status) {
        case 'Completed': return 'bg-green-100 text-green-800';
        case 'Failed': return 'bg-red-100 text-red-800';
        case 'Pending': return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const getVisitStatusClass = (status: VisitStatus) => {
    switch (status) {
        case VisitStatus.COMPLETED: return 'bg-green-100 text-green-800';
        case VisitStatus.SKIPPED: return 'bg-red-100 text-red-800';
        case VisitStatus.UPCOMING: return 'bg-blue-100 text-blue-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

type TripWithDetails = RoutePlan & {
    driverName: string;
    vehiclePlate: string;
};

type SalesTripWithDetails = SalesVisitRoutePlan & {
    salesName: string;
};

const DeliveryHistory: React.FC = () => {
    const [filterDate, setFilterDate] = useState('');
    const [selectedTrip, setSelectedTrip] = useState<TripWithDetails | null>(null);

    const { data: routes = [], isLoading: isLoadingRoutes } = useQuery<RoutePlan[]>({ queryKey: ['deliveryRoutes'], queryFn: () => getDeliveryRoutes() });
    const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({ queryKey: ['users'], queryFn: getUsers });
    const { data: vehicles = [], isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({ queryKey: ['vehicles'], queryFn: getVehicles });

    const tripsWithDetails = useMemo(() => {
        return routes
            .filter(route => !filterDate || route.date === filterDate)
            .map(route => ({
                ...route,
                driverName: users.find(u => u.id === route.driverId)?.name || 'N/A',
                vehiclePlate: vehicles.find(v => v.id === route.vehicleId)?.plateNumber || 'N/A',
            }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [routes, users, vehicles, filterDate]);

    const isLoading = isLoadingRoutes || isLoadingUsers || isLoadingVehicles;
    
    const stopsByStore = useMemo(() => {
        if (!selectedTrip) return {};
        return selectedTrip.stops.reduce((acc: Record<string, { storeName: string; address: string; orders: RouteStop[] }>, stop) => {
            if (!acc[stop.storeId]) {
                acc[stop.storeId] = { storeName: stop.storeName, address: stop.address, orders: [] };
            }
            acc[stop.storeId].orders.push(stop);
            return acc;
        }, {});
    }, [selectedTrip]);


    if (isLoading) return <p>Memuat riwayat pengiriman...</p>;

    return (
        <div className="space-y-6">
            <Card>
                <div className="max-w-xs">
                    <label className="text-sm font-medium">Filter Tanggal</label>
                    <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-full p-2 border rounded-md mt-1"/>
                </div>
            </Card>

            {tripsWithDetails.length === 0 ? (
                <Card><p className="text-center py-10 text-gray-500">Tidak ada riwayat perjalanan untuk tanggal yang dipilih.</p></Card>
            ) : (
                <div className="space-y-4">
                    {tripsWithDetails.map(trip => (
                        <Card key={trip.id}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-lg">{trip.driverName} - {trip.vehiclePlate}</p>
                                    <p className="text-sm text-gray-500">{new Date(trip.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                </div>
                                <button onClick={() => setSelectedTrip(trip)} className="bg-brand-light text-brand-dark font-semibold py-2 px-4 rounded-lg">
                                    Lihat Detail
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
            
            {selectedTrip && (
                 <Modal title={`Detail Perjalanan: ${selectedTrip.driverName} (${selectedTrip.vehiclePlate})`} isOpen={!!selectedTrip} onClose={() => setSelectedTrip(null)} size="lg">
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                       {Object.values(stopsByStore).map((storeGroup, index) => (
                            <div key={index} className="p-3 border rounded-lg bg-gray-50">
                                <p className="font-semibold">{index + 1}. {storeGroup.storeName}</p>
                                <p className="text-xs text-gray-500 mb-2">{storeGroup.address}</p>
                                <div className="space-y-2">
                                    {storeGroup.orders.map(order => (
                                        <div key={order.id} className="p-2 bg-white border rounded-md flex justify-between items-center">
                                            <p className="text-xs">ID Pesanan: {order.orderId.slice(-6).toUpperCase()}</p>
                                            <span className={`px-2 py-0.5 text-xs rounded-full ${getDeliveryStatusClass(order.status)}`}>{order.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                       ))}
                    </div>
                </Modal>
            )}
        </div>
    );
};

const SalesVisitHistory: React.FC = () => {
    const [filterDate, setFilterDate] = useState('');
    const [selectedTrip, setSelectedTrip] = useState<SalesTripWithDetails | null>(null);

    const { data: salesRoutes = [], isLoading: isLoadingRoutes } = useQuery<SalesVisitRoutePlan[]>({ queryKey: ['salesRoutes'], queryFn: () => getSalesRoutes() });
    const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({ queryKey: ['users'], queryFn: getUsers });

    const tripsWithDetails = useMemo(() => {
        return salesRoutes
            .filter(route => !filterDate || route.date === filterDate)
            .map(route => ({
                ...route,
                salesName: users.find(u => u.id === route.salesPersonId)?.name || 'N/A',
            }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [salesRoutes, users, filterDate]);

    const isLoading = isLoadingRoutes || isLoadingUsers;

    if (isLoading) return <p>Memuat riwayat kunjungan...</p>;
    
    return (
        <div className="space-y-6">
            <Card>
                <div className="max-w-xs">
                    <label className="text-sm font-medium">Filter Tanggal</label>
                    <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-full p-2 border rounded-md mt-1"/>
                </div>
            </Card>

            {tripsWithDetails.length === 0 ? (
                <Card><p className="text-center py-10 text-gray-500">Tidak ada riwayat kunjungan untuk tanggal yang dipilih.</p></Card>
            ) : (
                <div className="space-y-4">
                    {tripsWithDetails.map(trip => (
                        <Card key={trip.id}>
                             <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-lg">{trip.salesName}</p>
                                    <p className="text-sm text-gray-500">{new Date(trip.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                </div>
                                <button onClick={() => setSelectedTrip(trip)} className="bg-brand-light text-brand-dark font-semibold py-2 px-4 rounded-lg">
                                    Lihat Detail
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {selectedTrip && (
                 <Modal title={`Detail Kunjungan: ${selectedTrip.salesName}`} isOpen={!!selectedTrip} onClose={() => setSelectedTrip(null)} size="lg">
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                       {selectedTrip.stops.map((stop, index) => (
                            <div key={stop.visitId} className="p-3 border rounded-lg bg-gray-50">
                                <div className="flex justify-between items-start">
                                    <p className="font-semibold">{index + 1}. {stop.storeName}</p>
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${getVisitStatusClass(stop.status)}`}>{stop.status}</span>
                                </div>
                                <p className="text-xs text-gray-500">{stop.address}</p>
                                <p className="text-xs text-gray-700 mt-1 font-medium">Tujuan: {stop.purpose}</p>
                                 {stop.status === VisitStatus.SKIPPED && <p className="text-xs text-red-600 mt-1">Alasan: {stop.notes || 'Tidak ada alasan'}</p>}
                                 {stop.proofOfVisitImage && (
                                    <details className="mt-2 text-xs">
                                        <summary className="cursor-pointer text-blue-600 hover:underline">Lihat Bukti Kunjungan</summary>
                                        <img src={stop.proofOfVisitImage} alt={`Bukti untuk ${stop.storeName}`} className="mt-1 rounded-md border max-h-48" />
                                    </details>
                                 )}
                            </div>
                       ))}
                    </div>
                </Modal>
            )}
        </div>
    );
};


export const TripHistory: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'delivery' | 'sales'>('delivery');

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-3xl font-bold text-brand-dark">Riwayat Perjalanan</h1>
            
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('delivery')} className={`whitespace-nowrap flex items-center gap-2 py-4 px-3 border-b-2 font-medium text-sm ${activeTab === 'delivery' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <ICONS.fleet /> Pengiriman
                    </button>
                    <button onClick={() => setActiveTab('sales')} className={`whitespace-nowrap flex items-center gap-2 py-4 px-3 border-b-2 font-medium text-sm ${activeTab === 'sales' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                       <ICONS.users /> Kunjungan Sales
                    </button>
                </nav>
            </div>
            
            <div className="mt-6">
                {activeTab === 'delivery' ? <DeliveryHistory /> : <SalesVisitHistory />}
            </div>
        </div>
    );
};