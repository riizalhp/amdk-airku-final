import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { RouteMap } from '../ui/RouteMap';
import { Role, RoutePlan, Vehicle, VehicleStatus, SalesVisitRoutePlan, User, RouteStop } from '../../types';
import { ICONS } from '../../constants';
import { Modal } from '../ui/Modal';
import { getVehicles } from '../../services/vehicleApiService';
import { getUsers } from '../../services/userApiService';
import { createDeliveryRoute, getDeliveryRoutes, deleteDeliveryRoute, createSalesRoute, getSalesRoutes, deleteSalesRoute } from '../../services/routeApiService';

type PlanningTab = 'delivery' | 'salesVisit';

const getStatusClass = (status: VehicleStatus) => {
    switch (status) {
        case VehicleStatus.IDLE: return 'bg-green-100 text-green-800';
        case VehicleStatus.DELIVERING: return 'bg-blue-100 text-blue-800';
        case VehicleStatus.REPAIR: return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

export const RoutePlanning: React.FC = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<PlanningTab>('delivery');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const [expandedRouteIds, setExpandedRouteIds] = useState<string[]>([]);
    const [selectedMapRoute, setSelectedMapRoute] = useState<RouteStop[] | null>(null);

    // --- Data Fetching ---
    const { data: users = [] } = useQuery<User[]>({ queryKey: ['users'], queryFn: getUsers });
    const { data: vehicles = [] } = useQuery<Vehicle[]>({ queryKey: ['vehicles'], queryFn: getVehicles });
    const { data: deliveryRoutes = [], isLoading: isLoadingDelivery } = useQuery<RoutePlan[]>({ queryKey: ['deliveryRoutes'], queryFn: () => getDeliveryRoutes(), enabled: activeTab === 'delivery' });
    const { data: salesRoutes = [], isLoading: isLoadingSales } = useQuery<SalesVisitRoutePlan[]>({ queryKey: ['salesRoutes'], queryFn: () => getSalesRoutes(), enabled: activeTab === 'salesVisit' });

    // --- Delivery Planning ---
    const [deliveryForm, setDeliveryForm] = useState({ date: new Date().toISOString().split('T')[0], vehicleId: '', driverId: '' });
    
    const createDeliveryMutation = useMutation({
        mutationFn: createDeliveryRoute,
        onSuccess: (data) => {
            alert(data.message);
            queryClient.invalidateQueries({ queryKey: ['deliveryRoutes'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            setIsModalOpen(false);
        },
        onError: (err: any) => setModalError(err.response?.data?.message || 'Gagal membuat rute.'),
    });

    const deleteDeliveryMutation = useMutation({
        mutationFn: deleteDeliveryRoute,
        onSuccess: () => {
            alert('Perjalanan berhasil dihapus/dibatalkan.');
            queryClient.invalidateQueries({ queryKey: ['deliveryRoutes'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        },
        onError: (err: any) => alert(err.response?.data?.message || 'Gagal menghapus rute.'),
    });

    const handleCreateDeliveryPlan = () => {
        setModalError(null);
        if (!deliveryForm.date || !deliveryForm.vehicleId || !deliveryForm.driverId) {
            setModalError("Harap pilih tanggal, armada, dan pengemudi.");
            return;
        }
        createDeliveryMutation.mutate({
            deliveryDate: deliveryForm.date,
            vehicleId: deliveryForm.vehicleId,
            driverId: deliveryForm.driverId
        });
    };

    const handleDeleteDeliveryTrip = (tripId: string) => {
        if (window.confirm("Anda yakin ingin menghapus/membatalkan perjalanan ini? Pesanan akan dikembalikan ke status \'Pending\'.")) {
            deleteDeliveryMutation.mutate(tripId);
        }
    };

    // --- Sales Visit Planning ---
    const [salesForm, setSalesForm] = useState({ salesPersonId: '', visitDate: new Date().toISOString().split('T')[0] });
    
    const createSalesMutation = useMutation({
        mutationFn: createSalesRoute,
        onSuccess: (data) => {
            alert(data.message);
            queryClient.invalidateQueries({ queryKey: ['salesRoutes'] });
            setIsModalOpen(false);
        },
        onError: (err: any) => setModalError(err.response?.data?.message || 'Gagal membuat rute kunjungan.'),
    });
    
     const deleteSalesMutation = useMutation({
        mutationFn: deleteSalesRoute,
        onSuccess: () => {
            alert('Rencana kunjungan berhasil dihapus.');
            queryClient.invalidateQueries({ queryKey: ['salesRoutes'] });
        },
        onError: (err: any) => alert(err.response?.data?.message || 'Gagal menghapus rute.'),
    });

    const handleCreateSalesPlan = () => {
        setModalError(null);
        if (!salesForm.salesPersonId || !salesForm.visitDate) {
            setModalError("Harap pilih sales dan tanggal kunjungan.");
            return;
        }
        createSalesMutation.mutate(salesForm);
    };

    const toggleRouteExpansion = (routeId: string) => {
        setExpandedRouteIds(prev =>
            prev.includes(routeId)
                ? prev.filter(id => id !== routeId)
                : [...prev, routeId]
        );
    };

    // Memos
    const availableDrivers = useMemo(() => users.filter(u => u.role === Role.DRIVER), [users]);
    const availableSales = useMemo(() => users.filter(u => u.role === Role.SALES), [users]);
    
    const routesByDateAndDriver = useMemo(() => {
        const grouped: Record<string, Record<string, RoutePlan[]>> = {};
        deliveryRoutes.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach(route => {
            if (!grouped[route.date]) grouped[route.date] = {};
            if (!grouped[route.date][route.driverId]) grouped[route.date][route.driverId] = [];
            grouped[route.date][route.driverId].push(route);
        });
        return grouped;
    }, [deliveryRoutes]);
    
    const sortedSalesRoutes = useMemo(() => {
        return [...salesRoutes].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [salesRoutes]);

    const sortedDeliveryRoutesForMap = useMemo(() => {
        return deliveryRoutes.map(route => ({
            ...route,
            stops: [...route.stops].sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
        }));
    }, [deliveryRoutes]);

    const sortedSalesRoutesForMap = useMemo(() => {
        return salesRoutes.map(route => ({
            ...route,
            stops: [...route.stops].sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
        }));
    }, [salesRoutes]);


    return (
        <div className="p-8 space-y-6">
            <h1 className="text-3xl font-bold text-brand-dark">Perencanaan Rute</h1>
            
            <div className="border-b border-gray-200"><nav className="-mb-px flex space-x-6"><button onClick={() => setActiveTab('delivery')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'delivery' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Rute Pengiriman</button><button onClick={() => setActiveTab('salesVisit')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'salesVisit' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Rute Kunjungan Sales</button></nav></div>
            
            <div className="mt-6">
                {activeTab === 'delivery' ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center"><h2 className="text-2xl font-semibold">Rute Pengiriman Armada</h2><button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-brand-primary text-white font-bold py-2 px-4 rounded-lg"><ICONS.plus /> Buat Rencana</button></div>
                        {isLoadingDelivery ? <p>Memuat rute...</p> : Object.keys(routesByDateAndDriver).length === 0 ? (<Card><p className="text-center py-10 text-gray-500">Belum ada rencana rute pengiriman.</p></Card>) : (
                            Object.entries(routesByDateAndDriver).map(([date, driverRoutes]) => (<div key={date}><h3 className="text-xl font-bold pb-2 mb-4 border-b">Rencana untuk: {new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</h3><div className="space-y-6">{Object.entries(driverRoutes).map(([driverId, routeList]) => {
                                const driver = users.find(d => d.id === driverId); const vehicle = vehicles.find(v => v.id === routeList[0]?.vehicleId); if (!driver || !vehicle) return null;
                                return (<Card key={driverId}><div className="flex justify-between items-start mb-4"><div><h4 className="text-lg font-bold text-brand-primary">Pengemudi: {driver.name}</h4><p className="text-sm text-gray-500">Armada: {vehicle.plateNumber}</p></div><span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusClass(vehicle.status)}`}>{vehicle.status}</span></div>{routeList.map((route, index) => {
                                    const isExpanded = expandedRouteIds.includes(route.id);
                                     const stopsByStore = isExpanded ? route.stops.reduce((acc: Record<string, { storeName: string; address: string; orders: RouteStop[] }>, stop) => {
                                        if (!acc[stop.storeId]) {
                                            acc[stop.storeId] = { storeName: stop.storeName, address: stop.address, orders: [] };
                                        }
                                        acc[stop.storeId].orders.push(stop);
                                        return acc;
                                    }, {}) : {};

                                    return (
                                    <div key={route.id} className="mt-4 border-t pt-4">
                                        <div className="flex justify-between items-center">
                                            <h5 className="font-semibold">Perjalanan {index + 1} ({Object.keys(stopsByStore).length || route.stops.length} pemberhentian)</h5>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => { 
                                    const routeData = sortedDeliveryRoutesForMap.find(r => r.id === route.id); 
                                    if (routeData) setSelectedMapRoute(routeData.stops); 
                                }} className="text-sm font-semibold text-brand-primary hover:underline">Peta</button>
                                                <button onClick={() => toggleRouteExpansion(route.id)} className="text-sm font-semibold text-gray-600 hover:underline">{isExpanded ? 'Sembunyikan' : 'Lihat Detail'}</button>
                                                <button onClick={() => handleDeleteDeliveryTrip(route.id)} className="p-2 rounded-lg bg-red-100 text-red-700" title="Hapus/Batalkan Perjalanan"><ICONS.trash /></button>
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="mt-4 pl-4 border-l-2 border-brand-light space-y-4">
                                                {Object.values(stopsByStore).map((storeGroup, groupIndex) => (
                                                     <div key={storeGroup.storeName + groupIndex} className="relative pl-6">
                                                        <div className="absolute left-0 top-1 w-4 h-4 bg-brand-secondary text-white text-xs rounded-full flex items-center justify-center font-mono">
                                                            {groupIndex + 1}
                                                        </div>
                                                        <p className="font-semibold text-sm">{storeGroup.storeName}</p>
                                                        <p className="text-xs text-gray-500 mb-1">{storeGroup.address}</p>
                                                        <ul className="list-disc list-inside pl-4 space-y-1">
                                                            {storeGroup.orders.map(order => (
                                                                <li key={order.orderId} className="text-xs text-gray-600">
                                                                    ID Pesanan: {order.orderId.slice(-6).toUpperCase()}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    )
                                })}</Card>) 
                            })}</div></div>)) 
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center"><h2 className="text-2xl font-semibold">Rute Kunjungan Sales</h2><button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-brand-primary text-white font-bold py-2 px-4 rounded-lg"><ICONS.plus /> Buat Rencana</button></div>
                        {isLoadingSales ? <p>Memuat rute...</p> : (
                            <div className="space-y-4">
                                {sortedSalesRoutes.length === 0 ? (
                                    <Card><p className="text-center py-10 text-gray-500">Belum ada rencana rute kunjungan.</p></Card>
                                ) : (
                                    sortedSalesRoutes.map(route => {
                                        const isExpanded = expandedRouteIds.includes(route.id);
                                        return (
                                            <Card key={route.id}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-brand-primary">Rencana untuk {users.find(u => u.id === route.salesPersonId)?.name}</h3>
                                                        <p className="text-sm text-gray-500">Total: {route.stops.length} Kunjungan</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold bg-blue-100 text-blue-800 py-1 px-2 rounded-full">{new Date(route.date).toLocaleDateString('id-ID')}</span>
                                                    </div>
                                                </div>
                                                <div className="mt-4 border-t pt-4">
                                                    <div className="flex justify-between items-center">
                                                        <h5 className="font-semibold">Daftar Kunjungan</h5>
                                                        <div className="flex items-center gap-3">
                                                            <button onClick={() => { 
                                                                const routeData = sortedSalesRoutesForMap.find(r => r.id === route.id); 
                                                                if (routeData) setSelectedMapRoute(routeData.stops); 
                                                            }} className="text-sm font-semibold text-brand-primary hover:underline">Peta</button>
                                                            <button onClick={() => toggleRouteExpansion(route.id)} className="text-sm font-semibold text-gray-600 hover:underline">
                                                                {isExpanded ? 'Sembunyikan' : 'Lihat Detail'}
                                                            </button>
                                                            <button onClick={() => deleteSalesMutation.mutate(route.id)} className="p-2 rounded-lg bg-red-100 text-red-700" title="Hapus Rencana Kunjungan"><ICONS.trash /></button>
                                                        </div>
                                                    </div>
                                                    {isExpanded && (
                                                        <div className="mt-4 pl-4 border-l-2 border-brand-light space-y-3">
                                                            {route.stops.map((stop, stopIndex) => (
                                                                <div key={stop.visitId} className="relative pl-6">
                                                                    <div className="absolute left-0 top-1 w-4 h-4 bg-brand-secondary text-white text-xs rounded-full flex items-center justify-center font-mono">{stopIndex + 1}</div>
                                                                    <p className="font-semibold text-sm">{stop.storeName}</p>
                                                                    <p className="text-xs text-gray-500">{stop.address}</p>
                                                                    <p className="text-xs text-gray-600 mt-1 font-medium">Tujuan: {stop.purpose}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </Card>
                                        )
                                    })
                                )
                            }
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Modal title={activeTab === 'delivery' ? 'Buat Rencana Pengiriman' : 'Buat Rencana Kunjungan'} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                {modalError && <div className="bg-red-100 text-red-700 px-4 py-3 rounded mb-4">{modalError}</div>}
                {activeTab === 'delivery' ? (
                    <div className="space-y-4">
                        <div><label>Tanggal</label><input type="date" value={deliveryForm.date} onChange={e => setDeliveryForm(f => ({...f, date: e.target.value}))} className="w-full p-2 border rounded mt-1"/></div>
                        <div>
                            <label>Armada</label>
                            <select value={deliveryForm.vehicleId} onChange={e => setDeliveryForm(f => ({...f, vehicleId: e.target.value}))} className="w-full p-2 border rounded mt-1">
                                <option value="" disabled>-- Pilih --</option>
                                {vehicles.map(v => 
                                    <option key={v.id} value={v.id}>
                                        {v.plateNumber} ({v.region}) {v.status !== VehicleStatus.IDLE ? `(${v.status})` : ''}
                                    </option>
                                )}
                            </select>
                        </div>
                        <div><label>Pengemudi</label><select value={deliveryForm.driverId} onChange={e => setDeliveryForm(f => ({...f, driverId: e.target.value}))} className="w-full p-2 border rounded mt-1"><option value="" disabled>-- Pilih --</option>{availableDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                        <div className="flex justify-end pt-4"><button onClick={() => setIsModalOpen(false)} className="bg-gray-200 py-2 px-4 rounded-lg mr-2">Batal</button><button onClick={handleCreateDeliveryPlan} disabled={createDeliveryMutation.isPending} className="bg-brand-primary text-white py-2 px-4 rounded-lg disabled:bg-gray-400">{createDeliveryMutation.isPending ? 'Membuat...' : 'Hasilkan Rute'}</button></div>
                    </div>
                ) : (
                     <div className="space-y-4">
                        <div><label>Sales</label><select value={salesForm.salesPersonId} onChange={e => setSalesForm(f => ({...f, salesPersonId: e.target.value}))} className="w-full p-2 border rounded mt-1"><option value="" disabled>-- Pilih --</option>{availableSales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                        <div><label>Tanggal</label><input type="date" value={salesForm.visitDate} onChange={e => setSalesForm(f => ({...f, visitDate: e.target.value}))} className="w-full p-2 border rounded mt-1"/></div>
                        <div className="flex justify-end pt-4"><button onClick={() => setIsModalOpen(false)} className="bg-gray-200 py-2 px-4 rounded-lg mr-2">Batal</button><button onClick={handleCreateSalesPlan} disabled={createSalesMutation.isPending} className="bg-brand-primary text-white py-2 px-4 rounded-lg disabled:bg-gray-400">{createSalesMutation.isPending ? 'Membuat...' : 'Hasilkan Rute'}</button></div>
                    </div>
                )}
            </Modal>

            {/* Map Modal */}
            {selectedMapRoute && (
                <Modal title="Peta Rute" isOpen={!!selectedMapRoute} onClose={() => setSelectedMapRoute(null)} size="4xl">
                    <div style={{ height: '60vh', width: '100%' }}>
                        <RouteMap 
                            stops={selectedMapRoute} 
                            depot={{ lat: -7.8664161, lng: 110.1486773 }} 
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
};
