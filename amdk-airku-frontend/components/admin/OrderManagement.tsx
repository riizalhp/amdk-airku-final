import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { Order, OrderStatus, Store, Product, Vehicle, OrderItem, VehicleStatus } from '../../types';
import { ICONS } from '../../constants';
import { Modal } from '../ui/Modal';
import { getOrders, createOrder, updateOrder, deleteOrder, batchAssignOrders } from '../../services/orderApiService';
import { getStores } from '../../services/storeApiService';
import { getProducts } from '../../services/productApiService';
import { getVehicles } from '../../services/vehicleApiService';

const EnhancedStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
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

type CartItem = { productId: string; quantity: number; specialPrice?: number; originalPrice: number; };

const formatDateForInput = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDateDDMMYY = (dateString?: string): string => {
    if (!dateString) return '-';
    // This function now assumes dateString is in 'YYYY-MM-DD' format from the server
    const parts = dateString.split('-');
    if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}-${month}-${year.slice(-2)}`;
    }
    return dateString; // Fallback
};


const AddEditOrderModal: React.FC<{ isOpen: boolean; onClose: () => void; orderToEdit: Order | null; }> = ({ isOpen, onClose, orderToEdit }) => {
    const queryClient = useQueryClient();
    const [storeId, setStoreId] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [assignedVehicleId, setAssignedVehicleId] = useState<string | null>(null);
    const [desiredDeliveryDate, setDesiredDeliveryDate] = useState('');
    const [apiError, setApiError] = useState('');
    
    // States for store combobox
    const [storeSearch, setStoreSearch] = useState('');
    const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
    const blurTimeoutRef = useRef<number | null>(null);

    const { data: stores = [] } = useQuery<Store[]>({ queryKey: ['stores'], queryFn: getStores });
    const { data: products = [] } = useQuery<Product[]>({ queryKey: ['products'], queryFn: getProducts });
    const { data: vehicles = [] } = useQuery<Vehicle[]>({ queryKey: ['vehicles'], queryFn: getVehicles });
    
    const { mutate: createMutate, isPending: isCreating } = useMutation({
        mutationFn: createOrder,
        onSuccess: () => { 
            queryClient.invalidateQueries({ queryKey: ['orders'] }); 
            onClose(); 
            alert('Pesanan baru berhasil ditambahkan!');
        },
        onError: (err: any) => setApiError(err.response?.data?.message || 'Gagal membuat pesanan.'),
    });
    
    const { mutate: updateMutate, isPending: isUpdating } = useMutation({
        mutationFn: updateOrder,
        onSuccess: () => { 
            queryClient.invalidateQueries({ queryKey: ['orders'] }); 
            onClose(); 
            alert('Pesanan berhasil diperbarui!');
        },
        onError: (err: any) => setApiError(err.response?.data?.message || 'Gagal memperbarui pesanan.'),
    });

    useEffect(() => {
        if (isOpen) {
            if (orderToEdit) {
                const store = stores.find(s => s.id === orderToEdit.storeId);
                setStoreId(orderToEdit.storeId);
                setStoreSearch(store ? `${store.name} - ${store.owner}` : '');
                setCart(orderToEdit.items.map(item => ({ productId: item.productId, quantity: item.quantity, specialPrice: item.specialPrice, originalPrice: item.originalPrice })));
                setAssignedVehicleId(orderToEdit.assignedVehicleId);
                setDesiredDeliveryDate(orderToEdit.desiredDeliveryDate || '');
            } else {
                setStoreId(''); 
                setStoreSearch('');
                setCart([]); 
                setAssignedVehicleId(null); 
                setDesiredDeliveryDate('');
            }
            setApiError('');
        }
    }, [orderToEdit, isOpen, stores]);

    const filteredStores = useMemo(() => {
        if (!storeSearch) return stores;
        const lowercasedSearch = storeSearch.trim().toLowerCase();
        return stores.filter(store =>
            store.name.toLowerCase().includes(lowercasedSearch) ||
            store.owner.toLowerCase().includes(lowercasedSearch)
        );
    }, [stores, storeSearch]);
    
    const handleStoreInputBlur = () => {
        blurTimeoutRef.current = window.setTimeout(() => {
            setIsStoreDropdownOpen(false);
        }, 200);
    };

    const handleStoreInputFocus = () => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
        }
        setIsStoreDropdownOpen(true);
    };

    const handleAddProduct = (product: Product) => {
        const availableStock = product.stock - product.reservedStock;
        if (availableStock <= 0) return;
        setCart(prev => {
            const existing = prev.find(i => i.productId === product.id);
            if (existing) return prev.map(i => i.productId === product.id ? { ...i, quantity: Math.min(i.quantity + 1, availableStock) } : i);
            return [...prev, { productId: product.id, quantity: 1, originalPrice: product.price }];
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
                        if (value <= 0 || value === item.originalPrice) {
                            const { specialPrice, ...rest } = item;
                            return rest;
                        }
                        return { ...item, specialPrice: value };
                    }
                }
                return item;
            });
            return newCart.filter(item => item.quantity > 0);
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setApiError('');
        if (!storeId || cart.length === 0) { setApiError('Harap pilih toko yang valid dan tambahkan produk.'); return; }
        
        const orderPayload: any = { items: cart, desiredDeliveryDate: desiredDeliveryDate || undefined };
        if (orderToEdit) {
            orderPayload.id = orderToEdit.id;
            orderPayload.assignedVehicleId = assignedVehicleId;
            orderPayload.priority = orderToEdit.priority || false; // Keep priority status on manual edit
            updateMutate(orderPayload);
        } else {
            orderPayload.storeId = storeId;
            createMutate(orderPayload);
        }
    };
    
    const { totalAmount, totalNormalPrice } = useMemo(() => {
        let sellingPriceTotal = 0;
        let normalPriceTotal = 0;
        for (const item of cart) {
            const product = products.find(p => p.id === item.productId);
            if (product) {
                const price = item.specialPrice ?? item.originalPrice;
                sellingPriceTotal += price * item.quantity;
                normalPriceTotal += item.originalPrice * item.quantity;
            }
        }
        return { totalAmount: sellingPriceTotal, totalNormalPrice: normalPriceTotal };
    }, [cart, products]);

    return (
        <Modal title={orderToEdit ? 'Edit Pesanan' : 'Tambah Pesanan Baru'} isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {apiError && <div className="bg-red-100 text-red-700 px-4 py-3 rounded text-sm">{apiError}</div>}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <label className="block text-sm font-medium">Toko</label>
                        <input
                            type="text"
                            value={storeSearch}
                            onChange={e => {
                                setStoreSearch(e.target.value);
                                setStoreId('');
                                if (!isStoreDropdownOpen) setIsStoreDropdownOpen(true);
                            }}
                            onFocus={handleStoreInputFocus}
                            onBlur={handleStoreInputBlur}
                            className="w-full p-2 border rounded mt-1"
                            placeholder="Ketik nama toko atau pemilik..."
                            required
                            disabled={!!orderToEdit}
                            autoComplete="off"
                        />
                        {isStoreDropdownOpen && !orderToEdit && (
                            <div className="absolute z-20 w-full bg-white border rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                                {filteredStores.length > 0 ? filteredStores.map(store => (
                                    <div
                                        key={store.id}
                                        onMouseDown={() => {
                                            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                                            setStoreId(store.id);
                                            setStoreSearch(`${store.name} - ${store.owner}`);
                                            setIsStoreDropdownOpen(false);
                                        }}
                                        className="p-3 hover:bg-brand-light cursor-pointer border-b"
                                    >
                                        <p className="font-semibold">{store.name}</p>
                                        <p className="text-sm text-gray-500">Pemilik: {store.owner}</p>
                                    </div>
                                )) : (
                                    <div className="p-3 text-sm text-gray-500">Tidak ada toko ditemukan.</div>
                                )}
                            </div>
                        )}
                    </div>
                    <div><label className="block text-sm font-medium">Tgl. Diinginkan</label><input type="date" value={desiredDeliveryDate} onChange={e => setDesiredDeliveryDate(e.target.value)} className="w-full p-2 border rounded mt-1" /></div>
                </div>

                <div>
                    <label className="block text-sm font-medium">Produk Tersedia</label>
                    <div className="space-y-2 mt-1 max-h-32 overflow-y-auto p-2 bg-gray-50 border rounded-md">
                        {products.map(p => {
                            const availableStock = p.stock - p.reservedStock;
                            return (<div key={p.id} className="flex justify-between items-center p-2"><p>{p.name}<span className="text-xs text-gray-500 ml-2">(Stok: {availableStock})</span></p><button type="button" onClick={() => handleAddProduct(p)} className="bg-brand-secondary text-white px-2 py-1 rounded text-sm disabled:bg-gray-300" disabled={availableStock <= 0}>{availableStock > 0 ? 'Tambah' : 'Habis'}</button></div>);
                        })}
                    </div>
                </div>

                {cart.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium">Keranjang</label>
                        <div className="space-y-2 mt-1 border p-3 rounded-lg">
                             <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-start text-xs font-bold text-gray-600 px-1 pb-1 border-b">
                                <span className="md:col-span-2">Produk</span>
                                <span className="text-center">Jumlah</span>
                                <span className="text-center">Harga Jual (Rp)</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                            {cart.map(item => { 
                                const p = products.find(prod => prod.id === item.productId); 
                                if (!p) return null;
                                const displayPrice = item.specialPrice ?? item.originalPrice;
                                let profitText = null;

                                if (item.specialPrice !== undefined && item.specialPrice !== item.originalPrice) {
                                    const profit = item.specialPrice - item.originalPrice;
                                    profitText = (
                                        <p className={`text-xs ${profit > 0 ? 'text-green-600' : 'text-red-600'} text-center mt-1`}>
                                            {profit > 0 ? 'Untung' : 'Rugi'}: Rp {Math.abs(profit).toLocaleString('id-ID')}/item
                                        </p>
                                    );
                                }

                                return (
                                <div key={item.productId} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-start py-2 border-b">
                                    <div className="md:col-span-2">
                                        <p className="text-sm font-semibold">{p.name}</p>
                                        <p className="text-xs text-gray-400">Normal: {item.originalPrice.toLocaleString('id-ID')}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs md:hidden">Jumlah</label>
                                        <input type="number" min="1" value={item.quantity} onChange={e => handleUpdateCart(item.productId, 'quantity', parseInt(e.target.value) || 1)} className="w-full p-1 border rounded text-center"/>
                                    </div>
                                    <div>
                                        <label className="text-xs md:hidden">Harga Jual</label>
                                        <input type="number" min="0" value={displayPrice} onChange={e => handleUpdateCart(item.productId, 'specialPrice', parseInt(e.target.value) || 0)} className="w-full p-1 border rounded text-center"/>
                                        {profitText}
                                    </div>
                                </div>
                                ); 
                            })}
                            </div>
                            <div className="text-right font-bold mt-2 pt-2 border-t">
                                {totalAmount !== totalNormalPrice && (
                                    <p className="text-sm font-normal text-gray-500 mb-1">
                                        Total Harga Normal: Rp {totalNormalPrice.toLocaleString('id-ID')}
                                    </p>
                                )}
                                <p className="text-lg">Total Harga Jual: Rp {totalAmount.toLocaleString('id-ID')}</p>
                            </div>
                        </div>
                    </div>
                )}
                
                {orderToEdit && (<div><label className="block text-sm font-medium">Tugaskan ke Armada</label><select value={assignedVehicleId || ''} onChange={e => setAssignedVehicleId(e.target.value || null)} className="w-full p-2 border rounded mt-1" disabled={!storeId}><option value="">-- Tidak Ditugaskan --</option>{vehicles.filter(v => v.region === stores.find(s=>s.id === storeId)?.region).map(v => <option key={v.id} value={v.id}>{v.plateNumber}</option>)}</select></div>)}

                <div className="flex justify-end pt-4"><button type="button" onClick={onClose} className="bg-gray-200 font-bold py-2 px-4 rounded-lg mr-2">Batal</button><button type="submit" disabled={isCreating || isUpdating} className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400">{isCreating || isUpdating ? 'Menyimpan...' : (orderToEdit ? 'Simpan' : 'Buat')}</button></div>
            </form>
        </Modal>
    );
};

export const OrderManagement: React.FC = () => {
    const queryClient = useQueryClient();
    const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
    const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([]);
    
    // State for the new batch assignment flow
    const [batchRegion, setBatchRegion] = useState<'Timur' | 'Barat' | ''>('');
    const [batchDeliveryDate, setBatchDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
    const [batchVehicleId, setBatchVehicleId] = useState('');
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

    const { data: orders = [], isLoading: isLoadingOrders } = useQuery<Order[]>({ queryKey: ['orders'], queryFn: getOrders });
    const { data: vehicles = [], isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({ queryKey: ['vehicles'], queryFn: getVehicles });
    const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({ queryKey: ['products'], queryFn: getProducts });
    const { data: stores = [], isLoading: isLoadingStores } = useQuery<Store[]>({ queryKey: ['stores'], queryFn: getStores });
    
    const isLoading = isLoadingOrders || isLoadingVehicles || isLoadingProducts || isLoadingStores;
    const storeMap = useMemo(() => new Map(stores.map(s => [s.id, s])), [stores]);

    const { mutate: deleteMutate } = useMutation({
        mutationFn: deleteOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            alert('Pesanan berhasil dihapus.');
        },
        onError: (err: any) => alert(err.response?.data?.message || 'Gagal menghapus pesanan.'),
    });

    const batchAssignMutation = useMutation({
        mutationFn: batchAssignOrders,
        onSuccess: (data) => {
            alert(data.message);
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            setSelectedOrderIds([]);
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || 'Gagal menugaskan pesanan.');
        },
    });

    const toggleExpand = (orderId: string) => {
        setExpandedOrderIds(prev =>
            prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
        );
    };

    const filteredOrders = useMemo(() => {
        let ordersToDisplay: Order[];
        if (batchRegion) {
             ordersToDisplay = orders.filter(order => {
                const store = storeMap.get(order.storeId);
                return order.status === OrderStatus.PENDING && store?.region === batchRegion;
            });
        } else {
             ordersToDisplay = orders.filter(order => 
                (filterStatus === 'all' || order.status === filterStatus) && 
                (searchTerm === '' || order.storeName.toLowerCase().includes(searchTerm.toLowerCase()) || order.id.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        return ordersToDisplay.sort((a, b) => {
            const dateA = new Date(a.orderDate).getTime();
            const dateB = new Date(b.orderDate).getTime();
            if (dateB !== dateA) return dateB - dateA;
            return b.id.localeCompare(a.id);
        });
    }, [orders, filterStatus, searchTerm, batchRegion, storeMap]);

    const handleSelectOrder = (orderId: string) => {
        setSelectedOrderIds(prev =>
            prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
        );
    };
    
    const handleSelectAll = () => {
        if (!batchRegion) return;
        const selectableOrders = filteredOrders;
        if (selectedOrderIds.length === selectableOrders.length) {
            setSelectedOrderIds([]);
        } else {
            setSelectedOrderIds(selectableOrders.map(o => o.id));
        }
    };

    const handleBatchAssign = () => {
        if (!batchVehicleId || !batchDeliveryDate || selectedOrderIds.length === 0) {
            alert('Harap pilih armada, tanggal pengiriman, dan setidaknya satu pesanan.');
            return;
        }
        batchAssignMutation.mutate({ orderIds: selectedOrderIds, vehicleId: batchVehicleId, deliveryDate: batchDeliveryDate });
    };

    const handleOpenAddModal = () => { setOrderToEdit(null); setIsModalOpen(true); };
    const handleOpenEditModal = (order: Order) => { setOrderToEdit(order); setIsModalOpen(true); };
    const handleDeleteOrder = (orderId: string) => { if (window.confirm('Anda yakin ingin menghapus pesanan ini?')) deleteMutate(orderId); };
    
    const selectableOrdersInBatchMode = useMemo(() => batchRegion ? filteredOrders : [], [batchRegion, filteredOrders]);
    const vehiclesForBatch = useMemo(() => vehicles.filter(v => v.region === batchRegion), [vehicles, batchRegion]);

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-center"><h1 className="text-3xl font-bold text-brand-dark">Manajemen Pesanan</h1><button onClick={handleOpenAddModal} className="flex items-center gap-2 bg-brand-primary text-white font-bold py-2 px-4 rounded-lg"><ICONS.plus /> Tambah Pesanan</button></div>
            
            <Card className="bg-blue-50 border border-blue-200">
                <h2 className="text-lg font-bold text-brand-dark mb-2">Penugasan Pesanan Massal</h2>
                <p className="text-sm text-gray-600 mb-4">Pilih wilayah untuk memulai penugasan pesanan massal. Anda dapat memilih pesanan sebelum atau sesudah memilih tanggal dan armada.</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-sm font-medium">Langkah 1: Pilih Wilayah</label>
                        <select 
                            value={batchRegion} 
                            onChange={e => { setBatchRegion(e.target.value as any); setBatchVehicleId(''); setSelectedOrderIds([]); }}
                            className="w-full p-2 border rounded-md mt-1 bg-white">
                            <option value="">-- Pilih Wilayah --</option><option value="Timur">Timur</option><option value="Barat">Barat</option>
                        </select>
                    </div>
                    <div className={!batchRegion ? 'opacity-50' : ''} title={!batchRegion ? 'Pilih wilayah terlebih dahulu' : ''}>
                        <label className="text-sm font-medium">Langkah 2: Pilih Tanggal</label>
                        <input 
                            type="date" 
                            value={batchDeliveryDate} 
                            onChange={e => setBatchDeliveryDate(e.target.value)} 
                            disabled={!batchRegion} 
                            className="w-full p-2 border rounded-md mt-1 disabled:bg-gray-200 disabled:cursor-not-allowed" />
                    </div>
                    <div className={!batchRegion ? 'opacity-50' : ''} title={!batchRegion ? 'Pilih wilayah terlebih dahulu' : ''}>
                        <label className="text-sm font-medium">Langkah 3: Pilih Armada</label>
                        <select 
                            value={batchVehicleId} 
                            onChange={e => setBatchVehicleId(e.target.value)} 
                            disabled={!batchRegion} 
                            className="w-full p-2 border rounded-md mt-1 bg-white disabled:bg-gray-200 disabled:cursor-not-allowed">
                            <option value="" disabled>-- Pilih Armada --</option>
                            {vehiclesForBatch.map(v => (
                                <option key={v.id} value={v.id}>
                                    {v.plateNumber}{v.status !== VehicleStatus.IDLE ? ` (${v.status})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <button onClick={handleBatchAssign} disabled={!batchVehicleId || !batchDeliveryDate || selectedOrderIds.length === 0 || batchAssignMutation.isPending} className="w-full bg-brand-primary text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400">
                           {batchAssignMutation.isPending ? 'Menugaskan...' : `Tugaskan (${selectedOrderIds.length})`}
                        </button>
                    </div>
                </div>
            </Card>

            <Card><div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${batchRegion ? 'opacity-50' : ''}`}><div><label className="text-sm font-medium">Pencarian</label><input type="text" placeholder="Cari toko atau ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={!!batchRegion} className="w-full p-2 border rounded-md mt-1"/></div><div><label className="text-sm font-medium">Status</label><select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} disabled={!!batchRegion} className="w-full p-2 border rounded-md mt-1"><option value="all">Semua Status</option>{Object.values(OrderStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div></div></Card>

            <Card className="!p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-gray-700">
                        <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                            <tr>
                                <th scope="col" className="px-4 py-3">
                                    <input type="checkbox" className="h-4 w-4 rounded" disabled={!batchRegion || selectableOrdersInBatchMode.length === 0} checked={selectableOrdersInBatchMode.length > 0 && selectedOrderIds.length === selectableOrdersInBatchMode.length} onChange={handleSelectAll} aria-label="Select all orders"/>
                                </th>
                                <th scope="col" className="px-2 py-4 w-12"></th><th scope="col" className="px-6 py-4">ID Pesanan</th><th scope="col" className="px-6 py-4">Toko</th><th scope="col" className="px-6 py-4">Tgl. Pesan</th><th scope="col" className="px-6 py-4">Tgl. Diinginkan</th><th scope="col" className="px-6 py-4 text-right">Total</th><th scope="col" className="px-6 py-4">Armada</th><th scope="col" className="px-6 py-4">Status</th><th scope="col" className="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (<tr><td colSpan={10} className="text-center p-6">Memuat pesanan...</td></tr>) : filteredOrders.map(order => (
                                <React.Fragment key={order.id}>
                                    <tr className={`bg-white border-b hover:bg-gray-50 ${order.priority ? 'bg-yellow-50' : ''}`}>
                                        <td className="px-4 py-3">{order.status === OrderStatus.PENDING && batchRegion && (<input type="checkbox" className="h-4 w-4 rounded" checked={selectedOrderIds.includes(order.id)} onChange={() => handleSelectOrder(order.id)} aria-label={`Select order ${order.id}`}/>)}</td>
                                        <td className="px-2 py-4"><button onClick={() => toggleExpand(order.id)} className="p-2 rounded-full hover:bg-gray-200" aria-label="Lihat detail"><span className={`transition-transform duration-200 inline-block ${expandedOrderIds.includes(order.id) ? 'rotate-180' : 'rotate-0'}`}><ICONS.chevronDown /></span></button></td>
                                        <td className="px-6 py-4 font-mono text-gray-500"><div className="flex items-center gap-2">{order.priority && <span className="text-yellow-500" title="Prioritas"><ICONS.star width={16} height={16} /></span>}<span>{order.id.slice(-6).toUpperCase()}</span></div></td>
                                        <td className="px-6 py-4 font-medium text-gray-900">{order.storeName}</td><td className="px-6 py-4">{formatDateDDMMYY(order.orderDate)}</td><td className="px-6 py-4">{formatDateDDMMYY(order.desiredDeliveryDate)}</td><td className="px-6 py-4 text-right font-medium">Rp {order.totalAmount.toLocaleString('id-ID')}</td><td className="px-6 py-4">{vehicles.find(v => v.id === order.assignedVehicleId)?.plateNumber || '-'}</td><td className="px-6 py-4"><EnhancedStatusBadge status={order.status} /></td>
                                        <td className="px-6 py-4"><div className="flex justify-center items-center space-x-2">{(order.status === OrderStatus.PENDING && !batchRegion) && (<><button onClick={() => handleOpenEditModal(order)} className="p-2 text-blue-600 rounded-full hover:bg-blue-100" title="Edit Pesanan"><ICONS.edit width={18} height={18} /></button><button onClick={() => handleDeleteOrder(order.id)} className="p-2 text-red-600 rounded-full hover:bg-red-100" title="Hapus Pesanan"><ICONS.trash width={18} height={18} /></button></>)}</div></td>
                                    </tr>
                                    {expandedOrderIds.includes(order.id) && (
                                        <tr className="bg-gray-50"><td colSpan={10} className="p-0"><div className="p-4 mx-4 my-2 border bg-white rounded-lg shadow-inner"><div className="grid grid-cols-2 gap-4 mb-4 text-xs"><div className="font-semibold text-gray-500">Dipesan oleh: <p className="text-gray-800 font-normal">{order.orderedBy.name} ({order.orderedBy.role})</p></div><div className="font-semibold text-gray-500">Armada Ditugaskan: <p className="text-gray-800 font-normal">{vehicles.find(v => v.id === order.assignedVehicleId)?.plateNumber || 'Belum Ditugaskan'}</p></div></div><h4 className="font-semibold text-gray-800 mb-2 pt-2 border-t">Detail Produk Pesanan:</h4><table className="min-w-full text-xs"><thead className="bg-gray-200"><tr><th className="px-3 py-2 text-left">Produk</th><th className="px-3 py-2 text-center">Jumlah</th><th className="px-3 py-2 text-right">Harga Satuan</th><th className="px-3 py-2 text-right">Subtotal</th></tr></thead><tbody>{order.items.map(item => {const product = products.find(p => p.id === item.productId);if (!product) return <tr key={item.productId}><td colSpan={4} className="p-2 text-center text-red-500">Produk telah dihapus.</td></tr>;const price = item.specialPrice ?? item.originalPrice;const subtotal = price * item.quantity;return (<tr key={item.productId} className="border-b"><td className="px-3 py-2">{product.name}</td><td className="px-3 py-2 text-center">{item.quantity}</td><td className="px-3 py-2 text-right">Rp {price.toLocaleString('id-ID')}</td><td className="px-3 py-2 text-right font-medium">Rp {subtotal.toLocaleString('id-ID')}</td></tr>);})}</tbody></table></div></td></tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    {!isLoading && filteredOrders.length === 0 && <p className="text-center text-gray-500 py-8">Tidak ada pesanan ditemukan.</p>}
                </div>
            </Card>
            <AddEditOrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} orderToEdit={orderToEdit} />
        </div>
    );
};
