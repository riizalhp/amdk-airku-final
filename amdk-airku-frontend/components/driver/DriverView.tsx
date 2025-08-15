import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../../hooks/useAppContext';
import { ICONS } from '../../constants';
import { Card } from '../ui/Card';
import { RoutePlan, RouteStop, User, Vehicle, VehicleStatus } from '../../types';
import { Modal } from '../ui/Modal';
import { RouteMap } from '../ui/RouteMap';
import { getDeliveryRoutes, updateDeliveryStopStatus, startOrCompleteTrip } from '../../services/routeApiService';
import { getVehicles } from '../../services/vehicleApiService';

// Custom hook to get the previous value of a prop or state
function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
}

type DriverActiveView = 'current' | 'routeList' | 'summary';

export const DriverView: React.FC = () => {
    const { currentUser, logout } = useAppContext();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // -- Data Fetching --
    const { data: allRoutes = [], isLoading: isLoadingRoutes } = useQuery<RoutePlan[]>({
        queryKey: ['deliveryRoutes', { driverId: currentUser?.id, date: new Date().toISOString().split('T')[0] }],
        queryFn: () => getDeliveryRoutes({ driverId: currentUser?.id, date: new Date().toISOString().split('T')[0] }),
        enabled: !!currentUser,
    });
    const { data: vehicles = [], isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({ 
        queryKey: ['vehicles'], 
        queryFn: getVehicles 
    });

    // -- Core UI State --
    const [activeView, setActiveView] = useState<DriverActiveView>('current');
    const [activeTripIndex, setActiveTripIndex] = useState(0);
    const [showInterstitial, setShowInterstitial] = useState(false);

    // -- Mutations for Backend Actions --
    const startTripMutation = useMutation({
        mutationFn: (vehicleId: string) => startOrCompleteTrip(vehicleId, 'start'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
        onError: (err: any) => alert(err.response?.data?.message || 'Gagal memulai perjalanan.'),
    });

    const completeTripMutation = useMutation({
        mutationFn: (vehicleId: string) => startOrCompleteTrip(vehicleId, 'complete'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
        onError: (err: any) => alert(err.response?.data?.message || 'Gagal menyelesaikan perjalanan.'),
    });

    const updateStopMutation = useMutation({
        mutationFn: updateDeliveryStopStatus,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deliveryRoutes'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            resetConfirmationState();
        },
        onError: (err: any) => alert(err.response?.data?.message || 'Gagal memperbarui status.'),
    });

    // -- Derived State from Data (Memos) --
    const todayRoutes = useMemo(() => allRoutes.sort((a, b) => a.id.localeCompare(b.id)), [allRoutes]);
    const vehicleForTodaysRoute = useMemo(() => todayRoutes.length > 0 && vehicles.length > 0 ? vehicles.find(v => v.id === todayRoutes[0].vehicleId) : null, [todayRoutes, vehicles]);
    const isStarted = useMemo(() => vehicleForTodaysRoute?.status === VehicleStatus.DELIVERING, [vehicleForTodaysRoute]);
    const activeTrip = useMemo(() => isStarted ? todayRoutes[activeTripIndex] : null, [isStarted, todayRoutes, activeTripIndex]);
    const areAllTripsCompleted = useMemo(() => todayRoutes.length > 0 && todayRoutes.every(r => r.stops.every(s => s.status !== 'Pending')), [todayRoutes]);
    const previousActiveTrip = usePrevious(activeTrip);

    // -- Effects --
    useEffect(() => {
        const currentTripIsDone = activeTrip?.stops.every(s => s.status !== 'Pending') ?? false;
        const previousTripWasNotDone = previousActiveTrip?.stops.some(s => s.status === 'Pending') ?? true;
        const hasMoreTrips = activeTripIndex < todayRoutes.length - 1;
        if (currentTripIsDone && previousTripWasNotDone && hasMoreTrips) {
            setShowInterstitial(true);
        }
    }, [activeTrip, previousActiveTrip, activeTripIndex, todayRoutes.length]);
    
    useEffect(() => {
        if (areAllTripsCompleted && vehicleForTodaysRoute?.status === VehicleStatus.DELIVERING) {
            completeTripMutation.mutate(vehicleForTodaysRoute.id);
        }
    }, [areAllTripsCompleted, vehicleForTodaysRoute, completeTripMutation]);

    // -- Modal and Photo State --
    const [showProofModal, setShowProofModal] = useState(false);
    const [showFailModal, setShowFailModal] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [stopBeingConfirmed, setStopBeingConfirmed] = useState<RouteStop | null>(null);
    const [failureReason, setFailureReason] = useState('');
    const [showMap, setShowMap] = useState<RoutePlan | null>(null);
    const depotLocation = { lat: -7.8664161, lng: 110.1486773 };
    
    const resetConfirmationState = () => {
        setShowProofModal(false);
        setShowFailModal(false);
        setCapturedImage(null);
        setStopBeingConfirmed(null);
        setFailureReason('');
    };
    
    // -- Event Handlers --
    const handleStartFirstTrip = () => { if (vehicleForTodaysRoute) startTripMutation.mutate(vehicleForTodaysRoute.id); };
    const handleProceedToNextTrip = () => { setActiveTripIndex(i => i + 1); setShowInterstitial(false); setActiveView('current'); };
    const handleAttemptSuccess = (stop: RouteStop) => { setStopBeingConfirmed(stop); fileInputRef.current?.click(); };
    const handleFailDelivery = (stop: RouteStop) => { setStopBeingConfirmed(stop); setShowFailModal(true); };

    const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setCapturedImage(e.target?.result as string);
                if (!showFailModal) setShowProofModal(true);
            };
            reader.readAsDataURL(file);
        }
         if (event.target) event.target.value = '';
    };

    const handleConfirmDelivery = () => {
        if (!stopBeingConfirmed || !capturedImage) return;
        updateStopMutation.mutate({ stopId: stopBeingConfirmed.id, status: 'Completed', proofImage: capturedImage });
    };

    const handleConfirmFailure = () => {
        if (!stopBeingConfirmed || !failureReason) return;
        updateStopMutation.mutate({ stopId: stopBeingConfirmed.id, status: 'Failed', failureReason, proofImage: capturedImage || undefined });
    };
    
    // -- Reusable View Components --
    const NoRoutesMessage = () => <div className="p-8 h-full flex items-center justify-center"><Card><p className="text-center text-gray-600">Tidak ada rute yang ditugaskan untuk Anda hari ini.</p></Card></div>;
    const AllTripsCompletedMessage = () => <div className="p-8 text-center h-full flex items-center justify-center"><Card><span className="text-green-500 inline-block"><ICONS.checkCircle width={48} height={48} /></span><h2 className="text-2xl font-bold text-green-600 mt-2">Semua Tugas Selesai!</h2><p>Kerja bagus, {currentUser?.name}!</p></Card></div>;
    const StartTripView = () => (<div className="p-8 h-full flex flex-col justify-center"><Card><h2 className="text-xl font-bold text-center mb-4">Ringkasan Tugas Hari Ini</h2><div className="space-y-2"><div className="flex justify-between p-3 bg-gray-50 rounded-lg"><span className="text-gray-600">Total Perjalanan:</span><span className="font-bold">{todayRoutes.length}</span></div><div className="flex justify-between p-3 bg-gray-50 rounded-lg"><span className="text-gray-600">Total Pemberhentian:</span><span className="font-bold">{todayRoutes.flatMap(r => r.stops).length}</span></div></div><button onClick={handleStartFirstTrip} disabled={startTripMutation.isPending} className="mt-8 w-full bg-brand-primary text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"><ICONS.navigation /> {startTripMutation.isPending ? 'Memulai...' : 'Mulai Rute Saya'}</button></Card></div>);

    // -- View-Specific Components --
    const CurrentTripView: React.FC = () => {
        if (showInterstitial) {
            const completed = todayRoutes[activeTripIndex].stops.filter(s => s.status === 'Completed').length;
            const failed = todayRoutes[activeTripIndex].stops.filter(s => s.status === 'Failed').length;
            return (<div className="p-8 h-full flex flex-col justify-center text-center"><Card><span className="text-green-500 inline-block"><ICONS.checkCircle width={64} height={64} /></span><h2 className="text-2xl font-bold mt-4">Perjalanan {activeTripIndex + 1} Selesai!</h2><div className="mt-4 text-left space-y-2 bg-gray-50 p-3 rounded-lg w-full"><p><strong>Berhasil:</strong> {completed} pemberhentian</p><p><strong>Gagal:</strong> {failed} pemberhentian</p></div><p className="text-brand-dark font-semibold mt-6 bg-yellow-100 p-3 rounded-lg">Harap kembali ke gudang untuk muatan berikutnya.</p><button onClick={handleProceedToNextTrip} className="mt-6 w-full bg-brand-primary text-white font-bold py-3 rounded-lg">Lanjutkan ke Perjalanan Berikutnya</button></Card></div>);
        }
        if (!activeTrip) return <NoRoutesMessage />;

        type StoreGroup = { storeName: string; address: string; orders: RouteStop[] };
        const stopsByStore = useMemo(() => {
            if (!activeTrip) return {};
            return activeTrip.stops.reduce<Record<string, StoreGroup>>((acc, stop) => {
                if (!acc[stop.storeId]) {
                    acc[stop.storeId] = { storeName: stop.storeName, address: stop.address, orders: [] };
                }
                acc[stop.storeId].orders.push(stop);
                return acc;
            }, {});
        }, [activeTrip]);

        const storeGroups = useMemo(() => Object.values(stopsByStore), [stopsByStore]);
        const currentStoreGroupIndex = useMemo(() => storeGroups.findIndex(group => group.orders.some(o => o.status === 'Pending')), [storeGroups]);
        
        return (
            <div className="p-4 space-y-4">
                <Card className="p-4 bg-white shadow-lg">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold">Daftar Pemberhentian</h2>
                        <button onClick={() => setShowMap(activeTrip)} className="text-sm text-brand-primary font-semibold hover:underline flex items-center gap-1">
                            <ICONS.mapPin /> Lihat Peta
                        </button>
                    </div>
                </Card>
    
                <div className="space-y-4">
                    {storeGroups.map((storeGroup, groupIndex) => {
                        const isCurrentStore = groupIndex === currentStoreGroupIndex;
                        const isGroupCompleted = storeGroup.orders.every(o => o.status !== 'Pending');
    
                        return (
                            <Card key={storeGroup.storeName + groupIndex} className={`p-4 transition-all ${isCurrentStore ? 'border-2 border-brand-primary shadow-xl' : ''} ${isGroupCompleted ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xl flex-shrink-0 ${isGroupCompleted ? 'bg-green-500' : isCurrentStore ? 'bg-brand-primary' : 'bg-gray-400'}`}>
                                            {isGroupCompleted ? <ICONS.checkCircle width={24} height={24} /> : groupIndex + 1}
                                        </span>
                                        <div>
                                            <p className={`font-bold text-lg ${isGroupCompleted ? 'line-through' : ''}`}>{storeGroup.storeName}</p>
                                            <p className="text-gray-600 text-sm">{storeGroup.address}</p>
                                        </div>
                                    </div>
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeGroup.address)}`} target="_blank" rel="noopener noreferrer" className="p-2 text-brand-primary">
                                        <ICONS.navigation />
                                    </a>
                                </div>
                                
                                <div className="mt-4 space-y-3 border-t pt-3">
                                    {storeGroup.orders.map(orderStop => {
                                        const isCompleted = orderStop.status === 'Completed';
                                        const isFailed = orderStop.status === 'Failed';
                                        return(
                                        <div key={orderStop.id} className="p-3 bg-gray-50 rounded-lg">
                                            <div className="flex justify-between items-center">
                                                <p className={`text-sm font-medium ${isCompleted || isFailed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                                   Pesanan: {orderStop.orderId.slice(-6).toUpperCase()}
                                                </p>
                                                 {isCompleted && <span className="text-green-600"><ICONS.checkCircle /></span>}
                                                 {isFailed && <span className="text-red-600"><ICONS.xCircle /></span>}
                                            </div>

                                            {isCurrentStore && orderStop.status === 'Pending' && (
                                                <div className="mt-3 grid grid-cols-2 gap-2">
                                                    <button onClick={() => handleAttemptSuccess(orderStop)} disabled={updateStopMutation.isPending} className="bg-green-500 text-white text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1">
                                                        <ICONS.checkCircle width={16} height={16} /> Berhasil
                                                    </button>
                                                    <button onClick={() => handleFailDelivery(orderStop)} disabled={updateStopMutation.isPending} className="bg-red-500 text-white text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1">
                                                        <ICONS.xCircle width={16} height={16} /> Gagal
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        );
                                    })}
                                </div>

                            </Card>
                        );
                    })}
                </div>
            </div>
        );
    }

    const RouteListView: React.FC = () => {
        if(todayRoutes.length === 0) return <NoRoutesMessage />;
        return (<div className="p-4 space-y-4">{todayRoutes.map((route, index) => {
            const isCurrent = isStarted && index === activeTripIndex && !showInterstitial;
            const isCompleted = route.stops.every(s => s.status !== 'Pending');
            const completedStops = route.stops.filter(s => s.status !== 'Pending').length;
            const progress = route.stops.length > 0 ? (completedStops / route.stops.length) * 100 : 0;
            return (<Card key={route.id} className={`p-4 transition-all ${isCurrent ? 'border-2 border-brand-primary' : ''}`}><details open={isCurrent}><summary className="cursor-pointer list-none flex justify-between items-center"><h3 className="text-lg font-bold text-brand-dark">Perjalanan {index + 1}</h3><span className={`px-2 py-1 text-xs font-bold rounded-full ${isCompleted ? 'bg-green-100 text-green-700' : isCurrent ? 'bg-blue-100 text-blue-700 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>{isCompleted ? 'Selesai' : isCurrent ? 'Berlangsung' : 'Akan Datang'}</span></summary>{isCurrent && (<div className="mt-2"><div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div></div><p className="text-xs text-right mt-1 text-gray-500">{completedStops} / {route.stops.length} selesai</p></div>)}<ol className="list-decimal list-inside space-y-2 mt-4 pl-2 text-sm">{route.stops.map(stop => <li key={stop.id} className={`${stop.status === 'Completed' ? 'line-through text-gray-400' : stop.status === 'Failed' ? 'text-red-500' : ''}`}>{stop.storeName}</li>)}</ol></details></Card>);
        })}</div>);
    };
    
    const SummaryView: React.FC = () => {
        const summaryData = todayRoutes.flatMap(r => r.stops).reduce((acc, stop) => { acc.total++; if(stop.status === 'Completed') acc.completed++; else if(stop.status === 'Failed') acc.failed++; else acc.pending++; return acc; }, { total: 0, completed: 0, failed: 0, pending: 0 });
        const progress = summaryData.total > 0 ? ((summaryData.completed + summaryData.failed) / summaryData.total) * 100 : 0;
        return (<div className="p-4"><Card><h2 className="text-xl font-bold mb-4 text-center">Ringkasan Hari Ini</h2><div className="w-full bg-gray-200 rounded-full h-2.5 mb-4"><div className="bg-brand-primary h-2.5 rounded-full" style={{ width: `${progress}%` }}></div></div><div className="grid grid-cols-2 gap-4 text-center"><div className="p-3 bg-blue-50 rounded-lg"><p className="text-2xl font-bold">{summaryData.total}</p><p className="text-sm">Total</p></div><div className="p-3 bg-gray-50 rounded-lg"><p className="text-2xl font-bold">{summaryData.pending}</p><p className="text-sm">Pending</p></div><div className="p-3 bg-green-50 rounded-lg"><p className="text-2xl font-bold text-green-600">{summaryData.completed}</p><p className="text-sm">Selesai</p></div><div className="p-3 bg-red-50 rounded-lg"><p className="text-2xl font-bold text-red-600">{summaryData.failed}</p><p className="text-sm">Gagal</p></div></div></Card></div>);
    };

    // -- Main Content Renderer --
    const renderContent = () => {
        if (isLoadingRoutes || isLoadingVehicles) return <div className="p-8 text-center">Memuat data...</div>;

        switch (activeView) {
            case 'current':
                // FIX: Check for completion first to avoid flashing the start screen.
                if (areAllTripsCompleted && todayRoutes.length > 0) return <AllTripsCompletedMessage />;
                if (todayRoutes.length > 0 && !isStarted) return <StartTripView />;
                if (todayRoutes.length === 0) return <NoRoutesMessage />;
                return <CurrentTripView />;
            case 'routeList':
                return <RouteListView />;
            case 'summary':
                if (todayRoutes.length === 0) return <NoRoutesMessage />;
                return <SummaryView />;
            default:
                return <NoRoutesMessage />;
        }
    };
    
    // -- Header Component --
    const { title, subtitle } = useMemo(() => {
        if (!isStarted && todayRoutes.length === 0) return { title: "Portal Driver", subtitle: currentUser?.name };
        if (areAllTripsCompleted) return { title: "Semua Selesai!", subtitle: "Kerja bagus!" };
        if (showInterstitial) return { title: `Perjalanan ${activeTripIndex + 1} Selesai`, subtitle: "Siap untuk berikutnya!" };
        const allStops = todayRoutes.flatMap(r => r.stops);
        const completedStopsCount = allStops.filter(s => s.status !== 'Pending').length;
        return { title: `Perjalanan ${activeTripIndex + 1}/${todayRoutes.length}`, subtitle: `${completedStopsCount}/${allStops.length} selesai` };
    }, [isStarted, areAllTripsCompleted, showInterstitial, activeTripIndex, todayRoutes, currentUser]);

    const Header: React.FC<{title: string; subtitle?: string}> = ({title, subtitle}) => (<header className="bg-brand-primary text-white p-4 flex justify-between items-center shadow-md flex-shrink-0"><div><h1 className="text-xl font-bold">{title}</h1>{subtitle && <p className="text-sm opacity-90">{subtitle}</p>}</div><button onClick={logout} className="p-2 rounded-full hover:bg-white/20" aria-label="Logout"><ICONS.logout /></button></header>);

    const navItems: {id: DriverActiveView, label: string, icon: React.ReactNode}[] = [
        { id: 'current', label: 'Saat Ini', icon: <ICONS.navigation /> },
        { id: 'routeList', label: 'List Rute', icon: <ICONS.route /> },
        { id: 'summary', label: 'Ringkasan', icon: <ICONS.dashboard /> },
    ];

    return (
        <div className="w-full md:w-[420px] mx-auto bg-brand-background flex flex-col h-screen shadow-2xl">
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handlePhotoCapture} />
            <Header title={title} subtitle={subtitle} />
            <main className="flex-1 overflow-y-auto">{renderContent()}</main>
            
            <nav className="grid grid-cols-3 bg-white border-t border-gray-200 shadow-[0_-4px_8px_rgba(0,0,0,0.05)] flex-shrink-0">
                {navItems.map(item => (
                    <button key={item.id} onClick={() => setActiveView(item.id)} className={`flex flex-col items-center justify-center pt-3 pb-2 transition-colors relative ${activeView === item.id ? 'text-brand-primary' : 'text-gray-500 hover:text-brand-primary'}`} aria-current={activeView === item.id ? 'page' : undefined}>
                        {activeView === item.id && (<span className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-brand-primary rounded-b-full"></span>)}
                        <span className="w-6 h-6">{item.icon}</span>
                        <span className="text-xs font-semibold mt-1 tracking-wide">{item.label}</span>
                    </button>
                ))}
            </nav>

            <Modal title="Konfirmasi Bukti Pengantaran" isOpen={showProofModal} onClose={resetConfirmationState}>
                {capturedImage && <img src={capturedImage} alt="Bukti"/>}
                <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={() => fileInputRef.current?.click()} className="bg-gray-200 py-2 px-4 rounded-lg">Ambil Ulang</button><button onClick={handleConfirmDelivery} disabled={updateStopMutation.isPending} className="bg-brand-primary text-white py-2 px-4 rounded-lg disabled:bg-gray-400">{updateStopMutation.isPending ? 'Mengonfirmasi...' : 'Konfirmasi'}</button></div>
            </Modal>
            <Modal title={`Gagal Kirim: ${stopBeingConfirmed?.storeName}`} isOpen={showFailModal} onClose={resetConfirmationState}>
                <textarea value={failureReason} onChange={e => setFailureReason(e.target.value)} placeholder="Alasan kegagalan (wajib)" rows={3} className="w-full p-2 border rounded mt-1"></textarea>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg"><ICONS.camera /> Ambil Foto (Opsional)</button>
                {capturedImage && <img src={capturedImage} alt="Bukti gagal" className="mt-2 rounded-lg"/>}
                <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={resetConfirmationState} className="bg-gray-200 py-2 px-4 rounded-lg">Batal</button><button onClick={handleConfirmFailure} disabled={!failureReason || updateStopMutation.isPending} className="bg-red-600 text-white py-2 px-4 rounded-lg disabled:bg-gray-400">{updateStopMutation.isPending ? 'Mengonfirmasi...' : 'Konfirmasi Gagal'}</button></div>
            </Modal>
            {showMap && <Modal title={`Peta Perjalanan`} isOpen={!!showMap} onClose={() => setShowMap(null)} size="xl"><RouteMap stops={showMap.stops} depot={depotLocation} /></Modal>}
        </div>
    );
};