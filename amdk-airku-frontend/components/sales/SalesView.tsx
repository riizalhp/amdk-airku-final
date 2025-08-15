import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../../hooks/useAppContext';
import { ICONS } from '../../constants';
import { Card } from '../ui/Card';
import { Store, Product, Visit, VisitStatus, SalesVisitRoutePlan, SalesVisitStop, SurveyResponse, SoughtProduct, CompetitorPrice, CompetitorVolume } from '../../types';
import { Modal } from '../ui/Modal';
import { DataView } from './DataView';
import { RouteMap } from '../ui/RouteMap';
import { getStores, createStore, classifyRegion } from '../../services/storeApiService';
import { getProducts } from '../../services/productApiService';
import { createOrder } from '../../services/orderApiService';
import { getVisits, updateVisit } from '../../services/visitApiService';
import { createSurvey } from '../../services/surveyApiService';
import { getSalesRoutes } from '../../services/routeApiService';

const getStatusClass = (status: VisitStatus) => {
    switch (status) {
        case VisitStatus.UPCOMING: return 'bg-blue-100 text-blue-800';
        case VisitStatus.COMPLETED: return 'bg-green-100 text-green-800';
        case VisitStatus.SKIPPED: return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const VisitSchedule: React.FC = () => {
    const { currentUser } = useAppContext();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: salesRoutes = [], isLoading: isLoadingRoutes } = useQuery<SalesVisitRoutePlan[]>({ queryKey: ['salesRoutes'], queryFn: () => getSalesRoutes() });
    const { data: visits = [], isLoading: isLoadingVisits } = useQuery<Visit[]>({ queryKey: ['visits'], queryFn: getVisits });

    const todayRoute = useMemo(() => {
        if (!currentUser) return undefined;
        const today = new Date().toISOString().split('T')[0];
        return salesRoutes.find(r => r.salesPersonId === currentUser.id && r.date === today);
    }, [salesRoutes, currentUser]);

    const [isStarted, setIsStarted] = useState(false);
    const [isMapVisible, setIsMapVisible] = useState(false);
    const [showProofModal, setShowProofModal] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [stopBeingConfirmed, setStopBeingConfirmed] = useState<SalesVisitStop | null>(null);
    const [stopToSkip, setStopToSkip] = useState<SalesVisitStop | null>(null);
    const [skipReason, setSkipReason] = useState('');
    
    const updateVisitMutation = useMutation({
        mutationFn: updateVisit,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['visits'] });
            setStopToSkip(null);
            setSkipReason('');
        },
    });

    const getVisitStatus = (visitId: string): VisitStatus => visits.find(v => v.id === visitId)?.status || VisitStatus.UPCOMING;

    const handleSkipVisit = (stop: SalesVisitStop) => { setStopToSkip(stop); };
    const handleAttemptSuccess = (stop: SalesVisitStop) => { setStopBeingConfirmed(stop); fileInputRef.current?.click(); };

    const handleConfirmSkip = () => {
        if (!stopToSkip || !skipReason) return;
        updateVisitMutation.mutate({ 
            id: stopToSkip.visitId, 
            status: VisitStatus.SKIPPED,
            notes: skipReason 
        });
    };

    const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setCapturedImage(e.target?.result as string);
                setShowProofModal(true);
            };
            reader.readAsDataURL(file);
        }
        if (event.target) event.target.value = '';
    };
    
    const handleConfirmVisit = () => {
        if (!stopBeingConfirmed || !capturedImage) return;
        updateVisitMutation.mutate({ id: stopBeingConfirmed.visitId, status: VisitStatus.COMPLETED, proofOfVisitImage: capturedImage });
        setShowProofModal(false); setCapturedImage(null); setStopBeingConfirmed(null);
    };

    if (isLoadingRoutes || isLoadingVisits) return <Card><p className="text-center p-4">Memuat jadwal...</p></Card>;
    if (!todayRoute) return <Card><p className="text-center p-4">Tidak ada rute kunjungan untuk Anda hari ini.</p></Card>;

    const allTasksCompleted = todayRoute.stops.every(stop => getVisitStatus(stop.visitId) !== VisitStatus.UPCOMING);
    
    if (allTasksCompleted) return <Card className="text-center p-6"><h2 className="text-2xl font-bold text-green-600">Kerja Bagus!</h2><p>Semua kunjungan untuk hari ini telah selesai.</p></Card>;

    if (!isStarted) return (<Card className="text-center p-6"><h2 className="text-xl font-bold mb-4">Rencana Kunjungan Hari Ini</h2><p className="text-lg mb-6">{todayRoute.stops.length} Toko</p><button onClick={() => setIsStarted(true)} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"><ICONS.navigation /> Mulai Rute</button></Card>);

    const stopsWithStatus = todayRoute.stops.map(stop => ({...stop, status: getVisitStatus(stop.visitId)}));

    return (<div><input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handlePhotoCapture} />
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Rute Kunjungan</h2>
            <button onClick={() => setIsMapVisible(v => !v)} className="text-sm font-semibold text-brand-primary flex items-center gap-1 p-2 rounded-lg hover:bg-brand-light">
                {isMapVisible ? <ICONS.chevronDown className="w-4 h-4" /> : <ICONS.mapPin className="w-4 h-4" />}
                {isMapVisible ? 'Sembunyikan' : 'Peta'}
            </button>
        </div>
        {isMapVisible && (
            <Card className="mb-4 p-2">
                 <RouteMap
                    stops={todayRoute.stops.map(stop => ({
                        id: stop.visitId,
                        orderId: stop.visitId,
                        storeId: stop.storeId,
                        storeName: stop.storeName,
                        address: stop.address,
                        location: stop.location,
                        status: 'Pending',
                    }))}
                    depot={{ lat: -7.8664161, lng: 110.1486773 }}
                />
            </Card>
        )}
        <ol className="space-y-3">{stopsWithStatus.map((stop, index) => (<li key={stop.visitId}><Card className={`p-4 ${stop.status !== VisitStatus.UPCOMING ? 'opacity-60' : ''}`}><div className="flex items-start justify-between"><div className="flex items-start gap-4"><span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${getStatusClass(stop.status).split(' ')[0]}`}>{index + 1}</span><div><p className="font-bold">{stop.storeName}</p><p className="text-xs text-gray-500">{stop.address}</p><p className="text-sm mt-1 font-semibold">{stop.purpose}</p></div></div><a href={`https://www.google.com/maps/search/?api=1&query=${stop.address}`} target="_blank" rel="noopener noreferrer" className="p-2"><ICONS.navigation /></a></div>{stop.status === VisitStatus.UPCOMING && (<div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => handleAttemptSuccess(stop)} className="bg-green-500 text-white font-semibold py-2 rounded-lg">Selesai</button><button onClick={() => handleSkipVisit(stop)} className="bg-yellow-500 text-white font-semibold py-2 rounded-lg">Lewati</button></div>)}</Card></li>))}</ol>
    <Modal title="Konfirmasi Bukti" isOpen={showProofModal} onClose={() => setShowProofModal(false)}>{capturedImage && <img src={capturedImage} alt="Bukti"/>}<div className="flex justify-end gap-2 pt-4"><button onClick={() => setShowProofModal(false)} className="bg-gray-200 py-2 px-4 rounded-lg">Ambil Ulang</button><button onClick={handleConfirmVisit} className="bg-brand-primary text-white py-2 px-4 rounded-lg">Konfirmasi</button></div></Modal>
    <Modal title={`Lewati Kunjungan: ${stopToSkip?.storeName}`} isOpen={!!stopToSkip} onClose={() => setStopToSkip(null)}>
        <div className="space-y-4">
            <label htmlFor="skipReason" className="block text-sm font-medium">Alasan (wajib)</label>
            <textarea id="skipReason" value={skipReason} onChange={e => setSkipReason(e.target.value)} rows={3} className="w-full p-2 border rounded" placeholder="Contoh: Toko tutup, pemilik tidak di tempat..."></textarea>
            <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setStopToSkip(null)} className="bg-gray-200 py-2 px-4 rounded-lg">Batal</button>
                <button onClick={handleConfirmSkip} disabled={!skipReason || updateVisitMutation.isPending} className="bg-brand-primary text-white py-2 px-4 rounded-lg disabled:bg-gray-400">
                    {updateVisitMutation.isPending ? 'Menyimpan...' : 'Konfirmasi'}
                </button>
            </div>
        </div>
    </Modal>
    </div>)
}

const parseCoordinatesFromURL = (url: string): { lat: number; lng: number } | null => {
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match && match[1] && match[2]) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    return null;
};

const AcquireStore: React.FC = () => {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({ name: '', owner: '', phone: '', address: '', googleMapsLink: '', isPartner: false, partnerCode: '' });
    const [apiError, setApiError] = useState('');
    const [detectedRegion, setDetectedRegion] = useState('');
    
    const classifyMutation = useMutation({ mutationFn: classifyRegion, onSuccess: (data) => { setDetectedRegion(data.region); if (data.region === 'Bukan di Kulon Progo') setApiError('Lokasi di luar wilayah layanan.'); else setApiError(''); }, onError: () => setApiError('Gagal mendeteksi wilayah.') });
    const createStoreMutation = useMutation({ mutationFn: createStore, onSuccess: () => { alert('Toko baru berhasil dibuat!'); queryClient.invalidateQueries({queryKey: ['stores']}); setForm({ name: '', owner: '', phone: '', address: '', googleMapsLink: '', isPartner: false, partnerCode: '' }); setDetectedRegion(''); }, onError: (err: any) => setApiError(err.response?.data?.message || 'Gagal membuat toko.') });
    
    const handleClassify = () => { const coords = parseCoordinatesFromURL(form.googleMapsLink); if (coords) classifyMutation.mutate(coords); else setApiError('Link Google Maps tidak valid.'); };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault(); setApiError('');
        const coords = parseCoordinatesFromURL(form.googleMapsLink);
        if (!coords || !detectedRegion || detectedRegion === 'Bukan di Kulon Progo') { setApiError('Lokasi tidak valid atau belum dideteksi.'); return; }
        if (form.isPartner && !form.partnerCode) { setApiError('Kode Mitra wajib diisi.'); return; }
        createStoreMutation.mutate({ ...form, location: coords, region: detectedRegion });
    };

    return (<Card>
        <h2 className="text-xl font-bold mb-4">Akuisisi Toko Baru</h2>
        <Card className="bg-blue-50 border border-blue-200 mb-4">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 text-brand-primary pt-1">
                    <ICONS.mapPin />
                </div>
                <div>
                    <h3 className="text-md font-bold text-brand-dark">Informasi Pembagian Wilayah</h3>
                    <p className="text-sm text-gray-700 mt-1">
                        Titik penentu wilayah <strong>Timur</strong> dan <strong>Barat</strong> adalah garis bujur (longitude) kantor PDAM Tirta Binangun di <strong>110.1486773</strong>.
                        Deteksi wilayah otomatis akan mengklasifikasikan lokasi toko berdasarkan titik ini.
                    </p>
                </div>
            </div>
        </Card>
        <form className="space-y-4" onSubmit={handleSubmit}>{Object.entries({name: 'Nama Toko', owner: 'Nama Pemilik', phone: 'No. Telepon', address: 'Alamat', googleMapsLink: 'Link Google Maps'}).map(([key, placeholder]) => <input key={key} type="text" placeholder={placeholder} value={(form as any)[key]} onChange={e => setForm(f => ({...f, [key]: e.target.value}))} className="w-full p-2 border rounded" required/>)}<div className="p-4 bg-gray-50 rounded-lg"><div className="flex items-center gap-4"><button type="button" onClick={handleClassify} disabled={classifyMutation.isPending || !form.googleMapsLink} className="bg-brand-secondary text-white font-semibold py-2 px-4 rounded-lg disabled:bg-gray-400">{classifyMutation.isPending ? 'Menganalisis...' : 'Deteksi Wilayah'}</button>{detectedRegion && <p className="font-bold">Wilayah: <span className="text-lg">{detectedRegion}</span></p>}</div></div><div className="pt-4 border-t"><div className="flex items-center space-x-3"><input type="checkbox" id="isPartner" checked={form.isPartner} onChange={e => setForm(f=>({...f, isPartner: e.target.checked}))} className="h-4 w-4"/> <label htmlFor="isPartner">Jadikan Mitra</label></div>{form.isPartner && <input type="text" placeholder="Kode Mitra" value={form.partnerCode} onChange={e => setForm(f=>({...f, partnerCode: e.target.value}))} className="mt-2 w-full p-2 border rounded"/>}</div>{apiError && <p className="text-sm text-red-600">{apiError}</p>}<button type="submit" className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-400" disabled={createStoreMutation.isPending || !detectedRegion || detectedRegion === 'Bukan di Kulon Progo'}>Tambah Toko</button></form></Card>)
}

type CartItem = {
    productId: string;
    quantity: number;
    specialPrice?: number;
};

const RequestOrder: React.FC = () => {
    const queryClient = useQueryClient();
    const { currentUser } = useAppContext();
    const { data: stores = [] } = useQuery<Store[]>({ queryKey: ['stores'], queryFn: getStores });
    const { data: products = [] } = useQuery<Product[]>({ queryKey: ['products'], queryFn: getProducts });
    const [selectedStore, setSelectedStore] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [desiredDeliveryDate, setDesiredDeliveryDate] = useState('');
    
    const createOrderMutation = useMutation({ 
        mutationFn: createOrder, 
        onSuccess: () => { 
            alert('Pesanan berhasil dibuat!'); 
            queryClient.invalidateQueries({queryKey: ['orders']});
            queryClient.invalidateQueries({queryKey: ['products']});
            setSelectedStore(''); 
            setCart([]); 
            setDesiredDeliveryDate('');
        }, 
        onError: (err: any) => alert(err.response?.data?.message || 'Gagal membuat pesanan.') 
    });

    const handleAddProduct = (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const availableStock = product.stock - product.reservedStock;
        if (availableStock <= 0) {
            alert('Stok produk habis.');
            return;
        }

        setCart(prev => {
            const existing = prev.find(i => i.productId === productId);
            if (existing) {
                if (existing.quantity >= availableStock) {
                    alert('Stok tidak mencukupi.');
                    return prev;
                }
                return prev.map(i => i.productId === productId ? {...i, quantity: i.quantity + 1} : i);
            }
            return [...prev, {productId, quantity: 1}];
        });
    };

    const handleUpdateCart = (productId: string, field: 'quantity' | 'specialPrice', value: number) => {
        setCart(prevCart => {
            const product = products.find(p => p.id === productId);
            if (!product) return prevCart;

            const availableStock = product.stock - product.reservedStock;
            
            let newCart = prevCart.map(item => {
                if (item.productId === productId) {
                    if (field === 'quantity') {
                        let newQuantity = value;
                        if (value > availableStock) {
                            alert(`Stok untuk ${product.name} tidak mencukupi. Stok tersedia: ${availableStock}.`);
                            newQuantity = availableStock;
                        }
                        return { ...item, quantity: newQuantity };
                    }
                    if (field === 'specialPrice') {
                        // Unset specialPrice if it's the same as normal price or invalid (<=0)
                        if (value <= 0 || value === product.price) {
                            const { specialPrice, ...rest } = item;
                            return rest;
                        }
                        return { ...item, specialPrice: value };
                    }
                }
                return item;
            });

            // Filter out items with quantity 0 or less
            return newCart.filter(item => item.quantity > 0);
        });
    };


    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (!selectedStore || cart.length === 0) {
            alert("Harap pilih toko dan tambahkan produk.");
            return;
        }; 
        createOrderMutation.mutate({ 
            storeId: selectedStore, 
            items: cart, 
            desiredDeliveryDate: desiredDeliveryDate || undefined 
        }); 
    };

    const { totalAmount, totalNormalPrice } = useMemo(() => {
        let sellingPriceTotal = 0;
        let normalPriceTotal = 0;
        for (const item of cart) {
            const product = products.find(p => p.id === item.productId);
            if (product) {
                const price = item.specialPrice ?? product.price;
                sellingPriceTotal += price * item.quantity;
                normalPriceTotal += product.price * item.quantity;
            }
        }
        return { totalAmount: sellingPriceTotal, totalNormalPrice: normalPriceTotal };
    }, [cart, products]);

    return (
        <Card>
            <h2 className="text-xl font-bold mb-4">Request Pesanan Baru</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Pilih Toko</label>
                    <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} className="w-full p-2 border rounded mt-1" required>
                        <option value="" disabled>-- Pilih Toko --</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name} - {s.owner}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Tanggal Pengiriman Diinginkan</label>
                    <input 
                        type="date" 
                        value={desiredDeliveryDate} 
                        onChange={e => setDesiredDeliveryDate(e.target.value)}
                        className="w-full p-2 border rounded mt-1"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Produk Tersedia</label>
                    <div className="space-y-2 mt-1 max-h-40 overflow-y-auto p-1">
                        {products.map(p => { 
                            const stock = p.stock - p.reservedStock; 
                            return (
                                <div key={p.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                    <div>
                                        <span>{p.name}</span>
                                        <span className="text-xs text-gray-500 ml-2">(Stok: {stock})</span>
                                    </div>
                                    <button type="button" onClick={() => handleAddProduct(p.id)} disabled={stock <= 0} className="bg-brand-secondary text-white px-2 py-1 rounded text-sm disabled:bg-gray-300">
                                        {stock > 0 ? 'Tambah' : 'Habis'}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
                {cart.length > 0 && 
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Keranjang</label>
                        <div className="space-y-2 mt-1 border p-2 rounded-lg">
                             <div className="grid grid-cols-5 gap-2 text-xs font-bold text-gray-600 px-1 pb-1 border-b">
                                <span className="col-span-2">Produk</span>
                                <span className="text-center">Jumlah</span>
                                <span className="col-span-2 text-center">Harga Jual (Rp)</span>
                            </div>
                            {cart.map(item => {
                                const product = products.find(p => p.id === item.productId);
                                if (!product) return null;
                                const displayPrice = item.specialPrice ?? product.price;
                                let profitText = null;

                                if (item.specialPrice !== undefined && item.specialPrice !== product.price) {
                                    const profit = item.specialPrice - product.price;
                                    profitText = (
                                        <p className={`text-xs ${profit > 0 ? 'text-green-600' : 'text-red-600'} text-center`}>
                                            {profit > 0 ? 'Untung' : 'Rugi'}: Rp {Math.abs(profit).toLocaleString('id-ID')}/item
                                        </p>
                                    );
                                }
                                
                                return (
                                    <div key={item.productId} className="grid grid-cols-5 gap-2 items-center py-2">
                                        <div className="col-span-2">
                                            <span className="text-sm">{product.name}</span>
                                            <p className="text-xs text-gray-400">Normal: {product.price.toLocaleString('id-ID')}</p>
                                        </div>
                                        <div className="flex justify-center">
                                            <input type="number" min="1" value={item.quantity} onChange={e => handleUpdateCart(item.productId, 'quantity', parseInt(e.target.value) || 1)} className="w-full p-1 border rounded text-center"/>
                                        </div>
                                        <div className="col-span-2">
                                            <input type="number" min="0" placeholder={product.price.toString()} value={displayPrice} onChange={e => handleUpdateCart(item.productId, 'specialPrice', parseInt(e.target.value) || 0)} className="w-full p-1 border rounded text-center"/>
                                            {profitText}
                                        </div>
                                    </div>
                                );
                            })}
                             <div className="text-right font-bold mt-2 pt-2 border-t">
                                {totalAmount !== totalNormalPrice && (
                                    <p className="text-sm font-normal text-gray-500 mb-1">Total Harga Normal: Rp {totalNormalPrice.toLocaleString('id-ID')}</p>
                                )}
                                <p className="text-lg">Total Harga Jual: Rp {totalAmount.toLocaleString('id-ID')}</p>
                            </div>
                        </div>
                    </div>
                }
                <button type="submit" className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-400" disabled={!selectedStore || cart.length === 0 || createOrderMutation.isPending}>
                    {createOrderMutation.isPending ? 'Mengirim...' : 'Kirim Request'}
                </button>
            </form>
        </Card>
    );
};

const MarketSurvey: React.FC = () => {
    const { currentUser } = useAppContext();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { data: products = [] } = useQuery<Product[]>({ queryKey: ['products'], queryFn: getProducts });

    const initialFormState: Omit<SurveyResponse, 'id' | 'salesPersonId'> = { storeName: '', storeAddress: '', storePhone: '', surveyDate: new Date().toISOString().split('T')[0], mostSoughtProducts: [], popularAirkuVariants: [], competitorPrices: [], competitorVolumes: [], feedback: '', proofOfSurveyImage: ''};

    const [form, setForm] = useState(initialFormState);
    const [newSoughtProduct, setNewSoughtProduct] = useState({ brand: '', variant: '' });
    const [newAirkuVariant, setNewAirkuVariant] = useState('');
    
    const createSurveyMutation = useMutation({ 
        mutationFn: createSurvey, 
        onSuccess: () => { 
            alert('Laporan survei berhasil dikirim!'); 
            queryClient.invalidateQueries({queryKey: ['surveys']}); 
            setForm(initialFormState); 
        }, 
        onError: (err: any) => alert(err.response?.data?.message || 'Gagal mengirim survei.')
    });

    const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setForm(f => ({ ...f, proofOfSurveyImage: e.target?.result as string }));
            };
            reader.readAsDataURL(file);
        }
         if (event.target) event.target.value = '';
    };

    const handleReorder = (listName: 'mostSoughtProducts' | 'popularAirkuVariants', index: number, direction: 'up' | 'down') => {
        setForm(prevForm => {
            const list = [...(prevForm as any)[listName]];
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= list.length) return prevForm;
            [list[index], list[newIndex]] = [list[newIndex], list[index]];
            return { ...prevForm, [listName]: list };
        });
    };
    
    const handleAddSoughtProduct = () => {
        if(newSoughtProduct.brand && newSoughtProduct.variant) {
            setForm(prev => ({ ...prev, mostSoughtProducts: [...prev.mostSoughtProducts, newSoughtProduct]}));
            setNewSoughtProduct({ brand: '', variant: '' });
        }
    };

    const handleAddAirkuVariant = () => {
        if (newAirkuVariant && !form.popularAirkuVariants.includes(newAirkuVariant)) {
            setForm(prev => ({ ...prev, popularAirkuVariants: [...prev.popularAirkuVariants, newAirkuVariant] }));
            setNewAirkuVariant('');
        }
    };
    
    const handleCompetitorDataChange = (brand: string, type: 'price' | 'volume', value: string) => {
        setForm(prev => {
            if (type === 'price') {
                const newPrices = [...prev.competitorPrices];
                const existingIndex = newPrices.findIndex(p => p.brand === brand);
                const priceValue = Number(value);
                if (existingIndex > -1) {
                    if (priceValue > 0) newPrices[existingIndex].price = priceValue;
                    else newPrices.splice(existingIndex, 1);
                } else if (priceValue > 0) {
                    newPrices.push({ brand, variant: 'N/A', price: priceValue });
                }
                return { ...prev, competitorPrices: newPrices };
            } else { // volume
                const newVolumes = [...prev.competitorVolumes];
                const existingIndex = newVolumes.findIndex(v => v.brand === brand);
                if (existingIndex > -1) {
                    if (value) newVolumes[existingIndex].volume = value;
                    else newVolumes.splice(existingIndex, 1);
                } else if (value) {
                    newVolumes.push({ brand, variant: 'N/A', volume: value });
                }
                return { ...prev, competitorVolumes: newVolumes };
            }
        });
    };
    
    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (!currentUser || !form.storeName || !form.proofOfSurveyImage) {
            alert("Nama Toko dan Bukti Survei wajib diisi.");
            return;
        }; 
        createSurveyMutation.mutate(form); 
    };

    const competitors = useMemo(() => {
        const brands = form.mostSoughtProducts.map(p => p.brand).filter(b => b.toLowerCase() !== 'airku');
        return [...new Set(brands)];
    }, [form.mostSoughtProducts]);

    const airkuProductNames = products.map(p => p.name);

    return (
        <Card>
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handlePhotoCapture} />
            <h2 className="text-xl font-bold mb-4">Lakukan Survei Pasar</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <fieldset className="space-y-4 p-4 border rounded-lg">
                    <legend className="px-2 font-semibold text-brand-primary">Informasi Dasar & Bukti</legend>
                    <input type="text" placeholder="Nama Toko" value={form.storeName} onChange={e=>setForm(f=>({...f, storeName:e.target.value}))} className="w-full p-2 border rounded" required/>
                    <input type="text" placeholder="Alamat Toko" value={form.storeAddress} onChange={e=>setForm(f=>({...f, storeAddress:e.target.value}))} className="w-full p-2 border rounded" />
                    <input type="tel" placeholder="No. Telepon Toko" value={form.storePhone} onChange={e=>setForm(f=>({...f, storePhone:e.target.value}))} className="w-full p-2 border rounded" />
                    
                    <div>
                        <label className="block text-sm font-medium mb-2">Bukti Survei (Wajib)</label>
                        {form.proofOfSurveyImage ? (
                            <div className="relative"><img src={form.proofOfSurveyImage} alt="Bukti Survei" className="rounded-lg border w-full h-auto"/>
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute top-2 right-2 bg-white/70 text-black p-2 rounded-full">Ulang</button></div>
                        ) : (
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg text-gray-500 hover:bg-gray-50"><ICONS.camera /> Ambil Foto</button>
                        )}
                    </div>
                </fieldset>
                
                <fieldset className="space-y-4 p-4 border rounded-lg">
                    <legend className="px-2 font-semibold text-brand-primary">Detail Survei</legend>
                    <div>
                        <label className="block text-sm font-medium mb-2">1. Produk Air Mineral Paling Sering Dicari Konsumen?</label>
                        <div className="space-y-2">
                           {form.mostSoughtProducts.map((p, i) => (
                               <div key={i} className="flex items-center gap-2 bg-gray-100 p-2 rounded">
                                   <span className="font-bold">{i+1}.</span>
                                   <span className="flex-grow">{p.brand} - {p.variant}</span>
                                    <button type="button" onClick={() => handleReorder('mostSoughtProducts', i, 'up')} disabled={i === 0}>▲</button>
                                    <button type="button" onClick={() => handleReorder('mostSoughtProducts', i, 'down')} disabled={i === form.mostSoughtProducts.length - 1}>▼</button>
                               </div>
                           ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                           <input type="text" placeholder="Merek" value={newSoughtProduct.brand} onChange={e => setNewSoughtProduct(p => ({...p, brand: e.target.value}))} className="w-full p-2 border rounded"/>
                           <input type="text" placeholder="Varian" value={newSoughtProduct.variant} onChange={e => setNewSoughtProduct(p => ({...p, variant: e.target.value}))} className="w-full p-2 border rounded"/>
                           <button type="button" onClick={handleAddSoughtProduct} className="bg-brand-secondary text-white px-3 rounded">+</button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">2. Varian AIRKU yang Paling Banyak Dicari?</label>
                        <div className="space-y-2">
                           {form.popularAirkuVariants.map((v, i) => (
                               <div key={i} className="flex items-center gap-2 bg-gray-100 p-2 rounded">
                                   <span className="font-bold">{i+1}.</span>
                                   <span className="flex-grow">{v}</span>
                                    <button type="button" onClick={() => handleReorder('popularAirkuVariants', i, 'up')} disabled={i === 0}>▲</button>
                                    <button type="button" onClick={() => handleReorder('popularAirkuVariants', i, 'down')} disabled={i === form.popularAirkuVariants.length - 1}>▼</button>
                               </div>
                           ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                           <select value={newAirkuVariant} onChange={e => setNewAirkuVariant(e.target.value)} className="w-full p-2 border rounded bg-white">
                                <option value="" disabled>-- Pilih Varian --</option>
                                {airkuProductNames.map(name => <option key={name} value={name}>{name}</option>)}
                           </select>
                           <button type="button" onClick={handleAddAirkuVariant} className="bg-brand-secondary text-white px-3 rounded">+</button>
                        </div>
                    </div>
                    
                    {competitors.length > 0 && <>
                        <div>
                           <label className="block text-sm font-medium mb-2">3. Rata-Rata Harga Jual Kompetitor?</label>
                            {competitors.map(brand => (
                                <div key={brand} className="mt-2 p-2 border-t">
                                  <p className="font-semibold">{brand}</p>
                                  <input type="number" placeholder="Harga Jual (Rp)" onChange={e => handleCompetitorDataChange(brand, 'price', e.target.value)} value={form.competitorPrices.find(p=>p.brand === brand)?.price || ''} className="w-full p-2 border rounded mt-1"/>
                                </div>
                            ))}
                        </div>
                        <div>
                           <label className="block text-sm font-medium mb-2">4. Rata-Rata Order Toko per Bulan (Kompetitor)?</label>
                            {competitors.map(brand => (
                                <div key={brand} className="mt-2 p-2 border-t">
                                  <p className="font-semibold">{brand}</p>
                                  <input type="text" placeholder="Contoh: 50 dus/bulan" onChange={e => handleCompetitorDataChange(brand, 'volume', e.target.value)} value={form.competitorVolumes.find(v=>v.brand === brand)?.volume || ''} className="w-full p-2 border rounded mt-1"/>
                                </div>
                            ))}
                        </div>
                    </>}
                    
                    <div>
                        <label className="block text-sm font-medium mb-2">5. Masukan untuk AIRKU?</label>
                        <textarea placeholder="Saran, kritik, masukan dari toko..." value={form.feedback} onChange={e=>setForm(f=>({...f, feedback:e.target.value}))} className="w-full p-2 border rounded" rows={4}></textarea>
                    </div>
                </fieldset>
                
                <button type="submit" disabled={createSurveyMutation.isPending || !form.storeName || !form.proofOfSurveyImage} className="w-full bg-brand-primary text-white font-bold py-3 rounded-lg disabled:bg-gray-400">
                    {createSurveyMutation.isPending ? 'Mengirim...' : 'Kirim Laporan'}
                </button>
            </form>
        </Card>
    );
}

export const SalesView: React.FC = () => {
    const { logout, currentUser } = useAppContext();
    const [activePage, setActivePage] = useState('schedule');
    const navItems = [{ id: 'schedule', label: 'Kunjungan', icon: <ICONS.calendar /> }, { id: 'database', label: 'Data Toko', icon: <ICONS.store /> }, { id: 'order', label: 'Pesan', icon: <ICONS.orders /> }, { id: 'survey', label: 'Survei', icon: <ICONS.survey /> }, { id: 'acquire', label: 'Akuisisi', icon: <ICONS.plus /> }];

    return (<div className="w-full md:w-[420px] mx-auto bg-white flex flex-col h-screen shadow-2xl"><header className="bg-brand-primary text-white p-4 flex justify-between items-center"><h1 className="text-xl font-bold">Portal Sales: {currentUser?.name}</h1><button onClick={logout} className="p-2 rounded-full hover:bg-white/20"><ICONS.logout /></button></header><main className="flex-1 p-4 overflow-y-auto bg-brand-background">{activePage === 'schedule' ? <VisitSchedule /> : activePage === 'acquire' ? <AcquireStore /> : activePage === 'order' ? <RequestOrder /> : activePage === 'survey' ? <MarketSurvey /> : <DataView />}</main><nav className="grid grid-cols-5 gap-2 p-2 border-t bg-white">{navItems.map(item => (<button key={item.id} onClick={() => setActivePage(item.id)} className={`flex flex-col items-center p-2 rounded-lg ${activePage === item.id ? 'bg-brand-light' : ''}`}><span className="w-6 h-6">{item.icon}</span><span className="text-xs mt-1">{item.label}</span></button>))}</nav></div>);
};